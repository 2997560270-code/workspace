import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationDir = join(root, "supabase", "migrations");
const phaseOneMigration = readFileSync(
  join(migrationDir, "202607230002_causal_world_phase1.sql"),
  "utf8",
);
const approvedWorldMigration = readFileSync(
  join(migrationDir, "202608030001_approved_behavior_and_worlds.sql"),
  "utf8",
);

const userA = "00000000-0000-0000-0000-00000000000a";
const userB = "00000000-0000-0000-0000-00000000000b";
const suffix = randomUUID().replaceAll("-", "");
const dataDir = mkdtempSync(join(tmpdir(), "product-drill-local-rls-"));
const db = new PGlite(dataDir);

function assertRows(result, expected, message) {
  assert.deepEqual(result.rows, expected, message);
}

async function setupDatabase() {
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values ('${userA}'), ('${userB}');
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role app_user nologin;
  `);

  await db.exec(phaseOneMigration);
  await db.exec(approvedWorldMigration);
  await db.exec(`
    alter table public.causal_worlds force row level security;
    alter table public.causal_world_versions force row level security;
    alter table public.challenge_runs force row level security;
    alter table public.world_events force row level security;
    alter table public.decision_events force row level security;
    alter table public.interventions force row level security;
    alter table public.judgment_hypotheses force row level security;
    alter table public.hypothesis_evidence force row level security;
    grant usage on schema public to app_user;
    grant select, insert, update, delete on all tables in schema public to app_user;
  `);
}

async function asUser(userId, sql, params = []) {
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  await db.exec("set role app_user;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false);", [userId]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}

async function admin(sql, params = []) {
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  return db.query(sql, params);
}

async function seedFixtures() {
  const worldResult = await admin(
    `select id, current_version from public.causal_worlds
     where governance_status = 'approved' order by id limit 1`,
  );
  assert.equal(worldResult.rows.length, 1, "Approved world seed is missing.");
  const world = worldResult.rows[0];
  const ids = {
    run: `local-rls-run-${suffix}`,
    worldEvent: `local-rls-event-${suffix}`,
    decision: `local-rls-decision-${suffix}`,
    intervention: `local-rls-intervention-${suffix}`,
    hypothesis: `local-rls-hypothesis-${suffix}`,
    evidence: `local-rls-evidence-${suffix}`,
  };

  await admin(
    `insert into public.challenge_runs
      (id, user_id, world_id, world_version, model_version)
     values ($1, $2, $3, $4, 'local-rls')`,
    [ids.run, userB, world.id, world.current_version],
  );
  await admin(
    `insert into public.world_events
      (id, run_id, event_type, sequence_index, actor, payload)
     values ($1, $2, 'user_action', 0, 'user', '{"source":"local-rls"}')`,
    [ids.worldEvent, ids.run],
  );
  await admin(
    `insert into public.decision_events
      (id, run_id, world_event_id, judgment, chosen_action, expected_outcome,
       confidence, evidence_basis)
     values ($1, $2, $3, 'RLS judgment', 'RLS action', 'RLS outcome', 'medium', $4)`,
    [ids.decision, ids.run, ids.worldEvent, JSON.stringify([ids.worldEvent])],
  );
  await admin(
    `insert into public.interventions
      (id, run_id, decision_event_id, intervention_type, content, model_version, world_version)
     values ($1, $2, $3, 'feedback', 'RLS feedback', 'local-rls', $4)`,
    [ids.intervention, ids.run, ids.decision, world.current_version],
  );
  await admin(
    `insert into public.judgment_hypotheses
      (id, user_id, habit_name, confidence)
     values ($1, $2, $3, 'insufficient')`,
    [ids.hypothesis, userB, `local_rls_habit_${suffix}`],
  );
  await admin(
    `insert into public.hypothesis_evidence
      (id, hypothesis_id, decision_event_id, evidence_type, world_id, world_version, model_version)
     values ($1, $2, $3, 'supporting', $4, $5, 'local-rls')`,
    [ids.evidence, ids.hypothesis, ids.decision, world.id, world.current_version],
  );
  return { ids, world };
}

async function assertIsolation(table, id, update) {
  assertRows(
    await asUser(userA, `select id from public.${table} where id = $1`, [id]),
    [],
    `${table}: cross-user read exposed a row`,
  );
  assertRows(
    await asUser(userA, `update public.${table} set ${update.sql} where id = $1 returning id`, [id, ...update.params]),
    [],
    `${table}: cross-user update changed a row`,
  );
  assertRows(
    await asUser(userA, `delete from public.${table} where id = $1 returning id`, [id]),
    [],
    `${table}: cross-user delete removed a row`,
  );
}

async function main() {
  try {
    await setupDatabase();
    const { ids, world } = await seedFixtures();

    assertRows(
      await asUser(userA, "select id from public.causal_worlds where id = $1", [world.id]),
      [{ id: world.id }],
      "Approved worlds must remain readable to a user without ownership.",
    );
    assertRows(
      await asUser(userA, "select world_id, version from public.causal_world_versions where world_id = $1 and version = $2", [world.id, world.current_version]),
      [{ world_id: world.id, version: world.current_version }],
      "Approved world versions must remain readable to a user without ownership.",
    );

    const cases = [
      ["challenge_runs", ids.run, { sql: "status = 'abandoned'", params: [] }],
      ["world_events", ids.worldEvent, { sql: "payload = '{\"tampered\":true}'", params: [] }],
      ["decision_events", ids.decision, { sql: "judgment = 'tampered'", params: [] }],
      ["interventions", ids.intervention, { sql: "content = 'tampered'", params: [] }],
      ["judgment_hypotheses", ids.hypothesis, { sql: "confidence = 'high'", params: [] }],
      ["hypothesis_evidence", ids.evidence, { sql: "evidence_type = 'counter'", params: [] }],
    ];

    for (const [table, id, update] of cases) {
      await assertIsolation(table, id, update);
      assertRows(
        await asUser(userB, `select id from public.${table} where id = $1`, [id]),
        [{ id }],
        `${table}: owner lost access after a cross-user attempt`,
      );
      console.log(`PASS ${table}: local RLS blocked cross-user read/update/delete`);
    }
    console.log("PASS approved causal worlds and versions are readable");
    console.log("Local PostgreSQL RLS integration test passed.");
  } finally {
    await db.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

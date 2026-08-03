import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "SUPABASE_RLS_TEST_URL",
  "SUPABASE_RLS_TEST_ANON_KEY",
  "SUPABASE_RLS_TEST_SERVICE_ROLE_KEY",
];

const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
if (missingEnv.length) {
  console.error(
    `RLS integration test is not configured. Set ${missingEnv.join(", ")} in the test environment.`,
  );
  process.exit(1);
}

const url = process.env.SUPABASE_RLS_TEST_URL;
const anonKey = process.env.SUPABASE_RLS_TEST_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_RLS_TEST_SERVICE_ROLE_KEY;
const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
};

const admin = createClient(url, serviceRoleKey, clientOptions);
const publicClient = createClient(url, anonKey, clientOptions);
const suffix = randomUUID().replaceAll("-", "");
const password = `Rls-${randomUUID()}-Aa1!`;
const createdUserIds = [];

function userClient() {
  return createClient(url, anonKey, clientOptions);
}

async function createTestUser(label) {
  const email = `product-drill-rls-${label}-${suffix}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);

  const client = userClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { client, id: data.user.id };
}

async function requireApprovedWorld() {
  const { data: worlds, error: worldError } = await admin
    .from("causal_worlds")
    .select("id,current_version")
    .eq("governance_status", "approved")
    .limit(1);
  if (worldError) throw worldError;
  assert.ok(worlds?.length, "Apply the causal-world migrations before running the RLS test.");

  const world = worlds[0];
  const { data: versions, error: versionError } = await admin
    .from("causal_world_versions")
    .select("world_id,version")
    .eq("world_id", world.id)
    .eq("version", world.current_version)
    .limit(1);
  if (versionError) throw versionError;
  assert.equal(versions?.length, 1, "The approved world's current version is missing.");
  return { id: world.id, version: world.current_version };
}

async function insertFixtures(userId, world) {
  const ids = {
    run: `rls-run-${suffix}`,
    worldEvent: `rls-world-event-${suffix}`,
    decision: `rls-decision-${suffix}`,
    intervention: `rls-intervention-${suffix}`,
    hypothesis: `rls-hypothesis-${suffix}`,
    evidence: `rls-evidence-${suffix}`,
  };

  const inserts = [
    ["challenge_runs", {
      id: ids.run,
      user_id: userId,
      world_id: world.id,
      world_version: world.version,
      model_version: "rls-test",
    }],
    ["world_events", {
      id: ids.worldEvent,
      run_id: ids.run,
      event_type: "user_action",
      sequence_index: 0,
      actor: "user",
      payload: { source: "rls-test" },
    }],
    ["decision_events", {
      id: ids.decision,
      run_id: ids.run,
      world_event_id: ids.worldEvent,
      judgment: "RLS test judgment",
      chosen_action: "RLS test action",
      expected_outcome: "RLS test outcome",
      confidence: "medium",
      evidence_basis: [ids.worldEvent],
    }],
    ["interventions", {
      id: ids.intervention,
      run_id: ids.run,
      decision_event_id: ids.decision,
      intervention_type: "feedback",
      content: "RLS test feedback",
      model_version: "rls-test",
      world_version: world.version,
    }],
    ["judgment_hypotheses", {
      id: ids.hypothesis,
      user_id: userId,
      habit_name: `rls_test_habit_${suffix}`,
      confidence: "insufficient",
    }],
    ["hypothesis_evidence", {
      id: ids.evidence,
      hypothesis_id: ids.hypothesis,
      decision_event_id: ids.decision,
      evidence_type: "supporting",
      world_id: world.id,
      world_version: world.version,
      model_version: "rls-test",
    }],
  ];

  for (const [table, row] of inserts) {
    const { error } = await admin.from(table).insert(row);
    if (error) throw new Error(`Unable to seed ${table}: ${error.message}`);
  }
  return ids;
}

async function expectVisible(client, table, id) {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  if (error) throw error;
  assert.deepEqual(data, [{ id }], `${table}: owner should be able to read the fixture`);
}

async function expectIsolated(client, table, id, update) {
  const read = await client.from(table).select("id").eq("id", id);
  if (read.error) throw read.error;
  assert.deepEqual(read.data, [], `${table}: cross-user read exposed a row`);

  const changed = await client.from(table).update(update).eq("id", id).select("id");
  if (changed.error) throw changed.error;
  assert.deepEqual(changed.data, [], `${table}: cross-user update changed a row`);

  const deleted = await client.from(table).delete().eq("id", id).select("id");
  if (deleted.error) throw deleted.error;
  assert.deepEqual(deleted.data, [], `${table}: cross-user delete removed a row`);
}

async function cleanup() {
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`Cleanup warning for temporary user ${userId}: ${error.message}`);
  }
}

async function main() {
  try {
    const world = await requireApprovedWorld();

    const approvedWorldRead = await publicClient
      .from("causal_worlds")
      .select("id")
      .eq("id", world.id);
    if (approvedWorldRead.error) throw approvedWorldRead.error;
    assert.deepEqual(approvedWorldRead.data, [{ id: world.id }], "Approved worlds must be public-readable.");

    const approvedVersionRead = await publicClient
      .from("causal_world_versions")
      .select("world_id,version")
      .eq("world_id", world.id)
      .eq("version", world.version);
    if (approvedVersionRead.error) throw approvedVersionRead.error;
    assert.equal(approvedVersionRead.data?.length, 1, "Approved world versions must be public-readable.");

    const userA = await createTestUser("a");
    const userB = await createTestUser("b");
    const ids = await insertFixtures(userB.id, world);
    const cases = [
      ["challenge_runs", ids.run, { status: "abandoned" }],
      ["world_events", ids.worldEvent, { payload: { tampered: true } }],
      ["decision_events", ids.decision, { judgment: "tampered" }],
      ["interventions", ids.intervention, { content: "tampered" }],
      ["judgment_hypotheses", ids.hypothesis, { confidence: "high" }],
      ["hypothesis_evidence", ids.evidence, { evidence_type: "counter" }],
    ];

    for (const [table, id, update] of cases) {
      await expectVisible(userB.client, table, id);
      await expectIsolated(userA.client, table, id, update);
      await expectVisible(userB.client, table, id);
      console.log(`PASS ${table}: cross-user read/update/delete blocked`);
    }

    console.log("PASS approved causal worlds and versions are readable");
    console.log("Supabase RLS integration test passed.");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

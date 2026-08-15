import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const sourcePath = resolve(process.argv[2] ?? "data/knowledge-import.example.json");
const dryRun = process.argv.includes("--dry-run");
const raw = await readFile(sourcePath, "utf8");
const input = JSON.parse(raw);

if (!Array.isArray(input) || !input.length) throw new Error("Knowledge import must be a non-empty JSON array");
const seen = new Set();
const rows = input.map((item, index) => {
  if (!item || typeof item !== "object") throw new Error(`Entry ${index + 1} must be an object`);
  for (const key of ["title", "industry", "content", "source"]) {
    if (typeof item[key] !== "string" || item[key].trim().length < 2) throw new Error(`Entry ${index + 1} has an invalid ${key}`);
  }
  if (!Array.isArray(item.tags) || !item.tags.every((tag) => typeof tag === "string")) throw new Error(`Entry ${index + 1} has invalid tags`);
  const fingerprint = `${item.industry.trim()}::${item.title.trim()}`;
  if (seen.has(fingerprint)) throw new Error(`Duplicate entry: ${fingerprint}`);
  seen.add(fingerprint);
  return { title: item.title.trim(), industry: item.industry.trim(), tags: item.tags.map((tag) => tag.trim()).filter(Boolean), content: item.content.trim(), source: item.source.trim(), status: "review" };
});

if (dryRun) {
  process.stdout.write(`Validated ${rows.length} knowledge entries from ${sourcePath}\n`);
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await client.from("knowledge_entries").upsert(rows, { onConflict: "industry,title" });
if (error) throw error;
process.stdout.write(`Imported ${rows.length} knowledge entries in review status\n`);

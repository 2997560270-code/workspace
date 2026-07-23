const fs = require("node:fs");
const path = process.argv[2] ?? "evals/golden-sessions.jsonl";
const lines = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
const required = ["id", "scenarioId", "messages", "expected"];
const errors = [];
for (let index = 0; index < lines.length; index += 1) {
  try {
    const item = JSON.parse(lines[index]);
    for (const key of required) if (!(key in item)) errors.push(`line ${index + 1}: missing ${key}`);
    if (!Array.isArray(item.messages) || item.messages.length === 0) errors.push(`line ${index + 1}: messages empty`);
  } catch (error) {
    errors.push(`line ${index + 1}: invalid JSON (${error.message})`);
  }
}
if (lines.length < 30) errors.push(`expected at least 30 cases, found ${lines.length}`);
if (errors.length) {
  console.error(`INVALID\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`VALID ${lines.length} golden cases`);

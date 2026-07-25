#!/usr/bin/env python3
import json, sys
from pathlib import Path

REQUIRED = {"id", "scenarioId", "messages", "expected"}

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_golden.py <golden.jsonl>")
    errors=[]; count=0
    for line_no, line in enumerate(Path(sys.argv[1]).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip(): continue
        count += 1
        try: item=json.loads(line)
        except Exception as exc:
            errors.append(f"line {line_no}: invalid json: {exc}"); continue
        missing=REQUIRED-set(item)
        if missing: errors.append(f"line {line_no}: missing {sorted(missing)}")
        if not item.get("messages"): errors.append(f"line {line_no}: messages empty")
    if count == 0: errors.append("no cases")
    if errors:
        print("INVALID\n- " + "\n- ".join(errors)); raise SystemExit(1)
    print(f"VALID {count} cases")

if __name__ == "__main__": main()

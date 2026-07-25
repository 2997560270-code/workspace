#!/usr/bin/env python3
import json, sys
from pathlib import Path

REQUIRED = ["id", "scenarioVersion", "title", "industry", "primarySkill", "difficulty", "role", "triggerEvent", "context", "opening", "currentWorkflow", "constraints", "decisionChain", "hiddenFacts", "revealRules", "successCriteria", "commonMisjudgments", "sourceNotes", "reviewStatus", "rubricVersion"]
SKILLS = {"role", "workflow", "impact", "alternative", "metric"}

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_scenario.py <scenario.json>")
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    missing = [key for key in REQUIRED if key not in data]
    errors = []
    if missing: errors.append("missing: " + ", ".join(missing))
    if data.get("primarySkill") not in SKILLS: errors.append("invalid primarySkill")
    facts = data.get("hiddenFacts", {})
    absent_facts = sorted(SKILLS - set(facts))
    if absent_facts: errors.append("hiddenFacts missing: " + ", ".join(absent_facts))
    if not isinstance(data.get("scenarioVersion"), int) or data.get("scenarioVersion", 0) < 1: errors.append("scenarioVersion must be positive integer")
    if errors:
        print("INVALID\n- " + "\n- ".join(errors))
        raise SystemExit(1)
    print("VALID")

if __name__ == "__main__": main()

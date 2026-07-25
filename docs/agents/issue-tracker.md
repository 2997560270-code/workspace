# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body "..."`
- Add a label: `gh issue edit <number> --add-label "..."`
- Remove a label: `gh issue edit <number> --remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Run `gh issue` commands with `--repo 2997560270-code/workspace` to target the upstream
issue tracker. The fork (wu908/Product-Drill) has issues disabled.

## Pull requests as a request surface

PRs as a request surface: no.

## Skill operations

- When a skill says "publish to the issue tracker", create a GitHub issue:
  `gh issue create --repo 2997560270-code/workspace --title "..." --body "..."`
- When a skill says "fetch the relevant ticket":
  `gh issue view <number> --repo 2997560270-code/workspace --comments`

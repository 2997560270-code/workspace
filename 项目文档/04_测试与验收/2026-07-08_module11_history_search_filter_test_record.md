# Module 11: History Search And Filter Test Record

## Automated Tests

- module11 history search filters records by keyword
  - Open History page.
  - Input keyword: ????.
  - Expect matching record visible and unrelated record hidden.

- module11 history status chips filter records and update empty state
  - Open History page.
  - Click Pending Review filter.
  - Expect pending review records visible and evaluated records hidden.
  - Search a non-existing keyword.
  - Expect empty state text visible.

## Current Verification

- Command: npm.cmd run e2e -- tests/e2e/app-shell.spec.ts -g "module11"
- Result: 2 tests passed.

## Manual Test Entry

Open: C:\Users\A\Desktop\workspace\????-??MVP-??11??????.cmd

Manual steps:
1. Open the entry file.
2. Go to History from the left sidebar.
3. Type ???? in the search box.
4. Confirm only related records remain.
5. Clear search and click ???.
6. Confirm only pending review records remain.
7. Search ?????? and confirm the empty state appears.

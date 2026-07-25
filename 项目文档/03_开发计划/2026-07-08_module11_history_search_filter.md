# Module 11: History Search And Filter Plan

## Goal

Make the History page search box and filter chips usable. Users can search training records by keyword and filter records by status.

## Scope

- Search by time, scenario / mode, score, title, and status.
- Filter chips: All, This Week, Evaluated, Pending Review, High Value.
- Search and filters work together.
- Empty result state appears in the record list.
- Keep the confirmed demov3 layout and main button positions unchanged.

## Test-first Flow

1. Add E2E test for keyword search using the sample keyword: ????.
2. Add E2E test for Pending Review filter and empty state.
3. Verify both tests fail before implementation.
4. Implement minimal state for search query and active filter.
5. Re-run module E2E, then run full verification.

## Out Of Scope

- No backend search.
- No advanced filter drawer.
- No structural redesign of the history review panel.
- No GitHub or Feishu sync unless the user explicitly requests it.

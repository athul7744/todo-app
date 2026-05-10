# Test Suites

This folder holds the project's Vitest suites and lightweight test helpers.

## Layout

- `tests/notes/` — notes-specific logic and write-path tests.
- `tests/tasks/` — task-specific test entry points and notes about where task suites belong.
- `tests/tracker/` — tracker-specific test entry points and notes about where tracker suites belong.
- `tests/shared/` — reusable fixtures, builders, and assertions shared across app groups.

## Current Notes Suites

- `tests/notes/markdown-clipboard.test.ts`
  Verifies structured markdown list parsing for pasted note content, including nested children and empty trailing bullets.

- `tests/notes/notes-content.test.ts`
  Covers note document normalization, legacy text fallback, serialization, and plain-text extraction.

- `tests/notes/notes-tree.test.ts`
  Covers nested block tree construction plus visible-order neighbor lookups.

- `tests/notes/notes-write.test.ts`
  Covers note block write behavior around batched queued creates, retry after failed flush, update-before-flush, delete-before-flush, and immediate starter-page creation.

## Usage

- `npm test` — one-shot Vitest run.
- `npm run test:watch` — watch mode while developing.
- `node .\\node_modules\\vitest\\vitest.mjs run tests/notes` — focused notes test run when working on notes behavior.

Keep new tests close to the app area they protect, and move reusable builders or assertions into `tests/shared/` once they are used by more than one suite.
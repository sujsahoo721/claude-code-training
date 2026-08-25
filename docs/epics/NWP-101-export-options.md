# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Sujay Sahoo
**Status:** draft

## Problem

Ops exports the payments table several times a day for merchant queries, month-end reconciliation, and Finance requests. The export works but is fixed: every column, current filter only, no control over what comes out. Card last-four is in every file, so anything sent to a merchant has to be cleaned by hand. Dana's team estimates 3 to 4 hours a month of manual editing, and a near-miss last quarter where an unedited file nearly went to the wrong merchant. Giving ops a column and scope dialog on the existing Export button removes both the manual labor and the leak risk.

## Current state

The export is a single GET handler that always ships the full column set and the current filter, with no client control.

- `src/app/api/payments/export/route.ts` — `GET` calls `parseFilters` on the query string, runs `sortPayments(filterPayments(filters), ...)`, and returns `toCsv(rows)` with the default column set. Scope is always the current filter; columns are always `EXPORT_COLUMNS`.
- `src/lib/csv.ts` — defines `EXPORT_COLUMNS` (ten columns, including `last4`), `toCsv(payments, columns = EXPORT_COLUMNS)`, and `exportFilename(date)` which stamps only the date: `payments-2026-03-14.csv`. The serializer is already parameterized by columns, but the route never passes a subset.
- `src/data/queries.ts` — `parseFilters` validates client params against allowlists (status, sort, direction). `filterPayments` and `sortPayments` are the one query path. `queryPayments` paginates; the export route correctly bypasses pagination by calling `filterPayments` + `sortPayments` directly, not `queryPayments`.
- `src/app/payments/page.tsx` — the Export control is an `<a href="/api/payments/export?${query}">` styled as a Button. No dialog; it navigates straight to the endpoint with the current filter query string.
- `src/lib/csv.test.ts` — pins escaping and the column contract. Already exercises `toCsv([payment], ["id","amount"])` with arbitrary column subsets, so the serializer's column-selection behavior is covered; NWP-101 changes which columns the route chooses, not how a cell is written.

One thing in the ticket that deserves a check: it says "There is already a query builder behind `GET /api/payments`. Reuse it." That is accurate, and the export route already does. The work is column and scope selection, not a new filter path.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; format once at the edge | `CLAUDE.md`, `.claude/rules/money.md` | `toCsv` already calls `formatMoney` in the `amount` cell; a second formatter or a raw minor-unit dump makes the file unreadable or disagree with the table |
| One query builder; a second filter path is a defect | `CLAUDE.md`, `.claude/rules/api-routes.md` | Re-implementing filtering in the export route duplicates the allowlist logic and drifts from the list |
| Validate everything from the client against an allowlist | `.claude/rules/api-routes.md` | Column names arrive from the client; interpolating or accepting them unchecked lets a client request a column that has no serializer, producing `undefined` cells or leaking fields |
| Never return a full card number; last4 only | `CLAUDE.md`, `.claude/rules/api-routes.md` | The export must never grow a full-PAN column; `last4` is the only card field and it is off by default |
| Bucket and compare in UTC; display converts to merchant timezone | `CLAUDE.md`, `.claude/rules/api-routes.md` | Filename date uses `toISOString()` (UTC) today; scope labels must not introduce a local-time bucket |
| Use existing components; dialogs must be operable | `.claude/rules/components.md` | A hand-rolled modal without focus management and labels is inaccessible and duplicates `Dialog` |

## Approach

Add an options dialog to the Export button on `/payments` that lets ops pick columns and scope, then pass both to the existing export endpoint as query params. The endpoint validates the requested columns against `EXPORT_COLUMNS`, applies scope (current filter vs all payments by dropping the filter params), serializes with the existing `toCsv`, and stamps the scope into the filename. The column serializer and the query builder are reused untouched; only the route chooses a column subset and a scope, and the page adds a dialog.

**Considered and rejected:** building the export in the browser from the paginated table rows. The ticket calls this out explicitly: the table is paginated to 20 rows, so a browser-built export ships one page, not the result set. The export must stay server-side through the query builder. Also rejected: a new filter path for "all payments." Scope "all" is just calling `filterPayments` with the status/search/merchant/date params dropped, reusing the same builder.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/app/api/payments/export/route.ts` | Read `columns` and `scope` from the query string; validate `columns` against `EXPORT_COLUMNS` (drop unknowns, default to `EXPORT_COLUMNS` minus `last4`); when `scope=all`, call `filterPayments` with an empty filter object; pass the validated column subset to `toCsv`; build the filename from scope and date | Server-side enforcement of the column allowlist and scope; keeps the one query builder |
| `src/lib/csv.ts` | Add a `DEFAULT_EXPORT_COLUMNS` (or export a curated default excluding `last4`) and a helper to build the scope-stamped filename, e.g. `exportFilename({ scope, date })` returning `payments-<scope>-<utc-date>.csv` where `scope` is `filter` or `all` | Keeps the column contract and filename logic in the one CSV module; the route stays thin |
| `src/lib/csv.test.ts` | Add cases for the default column set excluding `last4`, the scope-stamped filename (`payments-filter-2026-08-13.csv`, `payments-all-2026-08-13.csv`), and that an empty validated column list yields a header-only or is rejected upstream | Extends the existing file per the ticket; no new test file |
| `src/app/payments/page.tsx` | Replace the plain `<a>` with a Button that opens a `Dialog` (from `src/components/`) containing column checkboxes (default `last4` unchecked), a scope select (current filter default), a visible row count, and a Download action that builds the export URL with `columns` and `scope` params and disables when no column is selected | Gives ops the control the ticket asks for; uses existing Dialog/Checkbox/Button primitives |
| `src/components/` | If no Checkbox primitive exists, add one following the existing Tremor/Radix pattern; otherwise reuse | `.claude/rules/components.md` says reach for what is here before adding a dependency |

## Plan

1. **Column allowlist and default** — Add the default column set (excluding `last4`) and a filename helper that takes scope to `src/lib/csv.ts`. Done when `csv.test.ts` passes for the new default and both scope filenames.
2. **Route enforcement** — Change `src/app/api/payments/export/route.ts` to parse and validate `columns` (reject/drop any not in `EXPORT_COLUMNS`) and `scope` (`filter` default, `all` drops filters), pass the subset to `toCsv`, and set the scope-stamped filename in `content-disposition`. Done when `curl /api/payments/export?columns=id,amount&scope=all` returns only those columns, all rows, and the right filename; `columns=last4` alone still works; `columns=bogus` is ignored.
3. **Row count for the dialog** — The page already has the full filtered count via `queryPayments`'s `total`. Surface that count in the dialog as the current-filter row count; for `scope=all` the count is `store.payments.length` (or an unfiltered `filterPayments({})` count). Done when the dialog shows the count before download for both scopes.
4. **Export dialog UI** — Replace the `<a>` in `src/app/payments/page.tsx` with a Button opening a `Dialog`: column checkboxes (last4 unchecked by default), scope select (current filter default), Download button that builds the URL and navigates, disabled when zero columns selected. Done when the dialog opens from the Export button, focus moves in and returns on close, Escape closes it, and Download hits the endpoint with the chosen params.
5. **Empty-column guard** — Deselecting every column disables Download in the dialog (client-side) and the route returns a 400 with a safe message if `columns` resolves to empty (server-side defense). Done when a no-column download is impossible from the UI and the endpoint refuses it.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last4 off by default | The dialog opens with `last4` unchecked; the exported file's header omits `last4` unless ops checks it |
| Scope: current filter or all; current filter default; row count visible before download | Dialog shows the count for the chosen scope; `scope=all` URL drops filter params and the row count matches `filterPayments({}).length`; default selection is current filter |
| Filename reflects scope and date | `exportFilename({ scope: "filter", date })` returns `payments-filter-2026-08-13.csv`; `scope=all` returns `payments-all-...csv`; unit test in `csv.test.ts` |
| Amounts stay minor units internally, formatted once on the way out, currency in its own column | `toCsv` still calls `formatMoney(payment.amount, payment.currency)` in the `amount` cell and emits `currency` as its own column when selected; no new formatter; existing csv tests still pass |
| Deselecting every column disables Download | With all checkboxes off, the Download button is disabled; the route also returns 400 for an empty validated column set |

`npm test` passes throughout. Run `/ship-ready` before the PR.

## Risks

- The dialog could regress the current one-click export flow for ops who just want the file. Mitigation: default the dialog so Enter or a default Download reproduces today's behavior (minus `last4`), so a quick export is still one click past open.
- `scope=all` on a large seed set could produce a big CSV. The store is in-memory and small, so this is acceptable for the workshop; note it as a follow-up, not a fix here.
- Column validation that silently drops unknown columns could hide a client bug. Mitigation: the route drops unknowns but the dialog only ever sends known columns, so a bogus column reaching the route means someone bypassed the UI, which the allowlist handles safely.

## Out of scope

- Persisting export presets per user (NWP-203 territory; the store is in memory and there is no database).
- A progress indicator for large exports; the dataset is small and synchronous.
- Export formats other than CSV.
- Editing seed data to make any case pass.

## Open questions

- Does `src/components/` already have a Checkbox primitive, or should one be added following the Tremor/Radix pattern used by the existing controls? Check before building the dialog.
- Should `scope=all` respect a merchant scoping the signed-in ops user belongs to, or is it truly every payment in the store? For the workshop, true all; confirm with Dana's team if this were real.

# EPIC · NWP-201 — Issue virtual cards from the console

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Sujay Sahoo
**Status:** reviewed

## Problem

Ops issues virtual cards by asking the platform team in Slack, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a thread rather than a form. Marcus wants ops to issue a card themselves, see the cards they have issued, and open one to check it.

## Current state

Every claim below carries a file path.

`src/data/store.ts` holds the in-memory store on `globalThis` with `merchants`, `payments`, `refunds`, `disputes`, `payouts`. There is no card collection and no cards route; `src/app/` has overview, payments, disputes, and payouts only. `src/data/generate.ts` builds the seed data once at boot with padded sequence ids (`pay_0001`, `re_0001`, `dp_0001`, `po_0001`).

`src/lib/money.ts` already has `formatMoney`, `formatMoneyCompact`, `sumMinorUnits`, and `parseAmountToMinorUnits`, the last of which converts client input like `"250.00"` into minor units at the boundary and returns `null` when the input is not a plain amount. `src/lib/dates.ts` already has `formatDate` for tables and `formatInZone` for merchant-timezone display. A second implementation of either is a defect, so this epic uses both and adds neither.

`src/data/queries.ts` is the one payment query builder, and its `parseFilters` shows the house allowlist pattern: read the param, check it against a `readonly` tuple, fall back to a safe default. Cards will follow the same shape rather than inventing a second validation style. `src/components/ui/payments/StatusBadge.tsx` maps a status union to a label, a dot colour, and a Badge variant; card statuses are a new union, so they need their own map rather than a widening of that one.

`src/components/Drawer.tsx` wraps Radix Dialog and is the only dialog primitive present; there is no `Dialog.tsx`, so the issue form uses Drawer. `Select.tsx`, `Input.tsx`, `Button.tsx`, `Table.tsx`, and `Badge.tsx` all exist and get reused.

One thing the ticket does not match: it asks for spend against the limit, but nothing in the store has ever held card spend. That value has to be seeded, so `generate.ts` grows a card generator rather than the detail page inventing a number at render time.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `merchant-console/CLAUDE.md`, `.claude/rules/money.md` | Cents drift, and a limit of `$250.00` can be stored as `250` |
| Generated numbers start `4242` and carry a valid Luhn check digit | `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| Numbers are generated on the server; one produced in the browser is a bug | `.claude/rules/cards.md` | The client can choose its own card number |
| The full number appears in the creation response and nowhere else | `.claude/rules/cards.md` | A full PAN sits in a list payload forever |
| `active ⇄ frozen`, either to `cancelled`, `cancelled` is terminal, guarded on the server | `.claude/rules/cards.md` | A cancelled card comes back to life via a crafted request |
| Everything from the client is checked against an allowlist before it reaches the store | `.claude/rules/api-routes.md` | An unlisted currency or a negative limit lands in the store |
| Storage is UTC; display converts to the merchant's timezone | `merchant-console/CLAUDE.md` | Created dates disagree between the list and the detail |
| One query builder per collection | `merchant-console/CLAUDE.md` | Two filter paths that drift apart |

## Approach

Server first, then UI. Three new modules carry the logic that has to be right: `src/lib/luhn.ts` generates a number on the `4242` BIN and computes its check digit, `src/lib/cards.ts` owns masking and the status state machine, and `src/data/cards.ts` is the single card query builder over a new `cards` array on the store. Two route handlers sit on top: `POST /api/cards` validates against an allowlist and returns the full number exactly once, `PATCH /api/cards/[id]` guards the transition. The list and detail pages are server components that read `src/data/cards.ts` directly, matching how `src/app/payments/page.tsx` calls `queryPayments` rather than fetching its own route; only the two mutations go through HTTP, from small client components.

The reveal-once guarantee is structural rather than procedural. `VirtualCard` has no field for a full number, so no list or detail payload can leak one even by accident — the generated number exists only as a local in the POST handler and in that one response body. Masking is derived from `last4`.

**Considered and rejected:** storing the full number encrypted on the card record and decrypting it for an authorized reveal endpoint. It is what a real issuer does, but here it means the repo holds full PANs, it invites a second reveal path the rules forbid, and there is no auth to gate it behind. Keeping the number un-storable is both simpler and closer to the stated rule. Also rejected: widening the payments `StatusBadge` union to cover card statuses, because `cancelled` and `frozen` want their own colours and the shared map is already carrying three domains.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `MerchantCategory`, `VirtualCard`, `CardFilters` |
| `src/lib/luhn.ts` | add | Check digit and `4242` BIN generation, server side |
| `src/lib/luhn.test.ts` | add | Check digit correctness, BIN prefix, length, format rejection |
| `src/lib/cards.ts` | add | `maskCardNumber`, `canTransition`, `spendPercentage` |
| `src/lib/cards.test.ts` | add | Every legal and illegal status transition, masking, percentage edges |
| `src/data/cards.ts` | add | The one card query builder plus `createCard` and `setCardStatus` |
| `src/data/generate.ts` | change | Seed cards with spend so the detail page has something real to show |
| `src/data/store.ts` | change | `cards` on the store interface and `createStore` |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` create with server-side validation |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, `PATCH` guarded status transition |
| `src/app/cards/page.tsx` | add | The list, with a written empty state |
| `src/app/cards/issue-card.tsx` | add | Client issue form and the one-time reveal screen |
| `src/app/cards/card-status-actions.tsx` | add | Freeze and unfreeze without a page reload |
| `src/app/cards/[id]/page.tsx` | add | Detail with spend against the limit |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Card status label, dot, variant |
| `src/components/ui/cards/SpendProgress.tsx` | add | Bar that turns amber past 80% |
| `src/app/siteConfig.ts` | change | `cards` base link |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Cards nav entry |

## Plan

Sequenced so each step ends somewhere verifiable.

1. **Types, store, and the card query builder** — done when: `npx tsc --noEmit` is clean and the store exposes seeded cards with spend.
2. **Luhn generator and card lib, with their tests** — done when: `npx vitest run src/lib/luhn.test.ts src/lib/cards.test.ts` passes, including a case asserting every generated number starts `4242` and validates.
3. **Route handlers with allowlist validation** — done when: curl against `POST /api/cards` returns 201 with a full number for a good body, and 400 with a readable message for a missing merchant, a zero limit, a negative limit, a limit above 5,000,000, and currency `JPY`.
4. **List page, issue form, reveal screen** — done when: the form issues a card, the reveal shows the full number once, and the row shows `•••• 4242` after it closes.
5. **Detail page with spend progress** — done when: a card opens, the bar reflects spend against the limit, and it is amber past 80%.
6. **Freeze and unfreeze from the list** — done when: the badge changes without a full page reload and a cancelled card refuses both.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card, appears in the list | Submit the form in the browser, the new row is present |
| `/cards` shows nickname, merchant, masked number, limit, status, created date | The rendered table has all six columns |
| Card detail shows the full record and spend against the limit | Open a card, read the record and the bar |
| Numbers are generated server side on `4242` with valid Luhn | `src/lib/luhn.test.ts` asserts prefix, length, and check digit over many generations |
| Reveal once, mask forever | Grep proves `VirtualCard` has no full-number field; the reveal appears only in the POST response |
| Server-side validation | curl each rejection case and read the status code and message |
| Status transitions | `src/lib/cards.test.ts` covers the whole matrix; `PATCH` returns 409 on an illegal move |

## Risks

- The reveal could survive in client state after the success screen closes. Mitigated by clearing the number when the drawer closes and never writing it to a card record.
- A float could sneak into the spend percentage. The percentage is derived for display only and never stored; the test pins the boundary at exactly 80%.
- Seeding cards in `generate.ts` touches a file payments already depend on. The change is additive and the payment generator is not altered.

## Out of scope

- Persistence, a database, an ORM, or a migration. The store is in memory on purpose; that is NWP-203.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a limit after issue, which is NWP-202.

## Open questions

- Where card spend comes from once payments can actually be made on a card. Seeded for now; the field is on the record so a real authorization path has somewhere to write.

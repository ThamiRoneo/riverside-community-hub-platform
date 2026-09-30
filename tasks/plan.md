# Implementation Plan: Remaining campaign and member contract gaps

## Overview

Close the last contract gaps in the audit and retire the off-contract surface.
The contract's campaign routes require a `progress_pct` field and a
single-campaign detail endpoint, neither of which exists. `GET /api/members/:id`
returns a bare profile where the contract asks for "profile + booking history
summary". Four routes exist that the contract does not describe and are being
retired, with the AdminDashboard realigned onto what remains.

## Correction to the task brief

The instruction was to delete `GET /api/campaigns/:id` because it is not on the
contract. **It is on the contract** (`RCH_API_CONTRACT.md:70`) and **it does not
exist in the code** — `campaigns.routes.ts` registers only list, create, update
and delete. So there was nothing to delete; Task 2 builds it. The route that
genuinely is off-contract is `DELETE /api/campaigns/:id`, which Task 3 retires.

## Architecture Decisions

- **`progress_pct` is computed in one place, not at each call site.** A
  `withProgress` shaper in `campaigns.routes.ts` maps a campaign row to its wire
  shape. Four endpoints return campaigns and any of them would drift if the
  arithmetic were written inline each time.
- **Progress is a whole percentage, rounded to the nearest integer.** A badge or
  a progress bar reads as a whole number, and the underlying amounts are already
  available for anyone needing precision.
- **A campaign with no goal reports `progress_pct: null`, not 0.** `goal_amount`
  is nullable (`0001_init_schema.sql:111`), and "0% funded" is a claim about a
  goal of zero, which is not the same as "no goal was set".
- **Progress is not clamped at 100.** Donations can exceed a goal and that is
  real information a fundraiser wants to see.
- **The member booking summary reuses the reports `by_status` shape** — an array
  of `{status, count}` covering all four statuses with zeros included
  (`reports.routes.ts:213`) — rather than inventing a second representation.
- **Counts split by time, not by status.** `upcoming_count` and `past_count`
  partition the member's bookings by `start_at` against now, matching
  `GET /api/bookings/mine` so the two endpoints cannot disagree.
- **The summary is computed in JS from one fetch.** A member has a handful of
  bookings; a second aggregate query would be a round trip for arithmetic.
- **Retiring `/renewal` means the renewal UI becomes explicit.** The old button
  called `/renewal` with an empty body and guessed a 30-day extension in the
  client. `PATCH /api/members/:id/tier` takes an explicit tier and expiry, so
  the dashboard asks for both rather than assuming.
- **Creating a member is not a contract capability.** Staff onboarding is
  `POST /api/staff/invite`, which already exists. The dashboard's create-member
  form is removed rather than pointed elsewhere, since it creates a `member`
  which the contract has no route for.

## Task List

### Phase 1: Campaign wire shape and retirement

- [x] Task 1: Add `progress_pct` to every campaign response
- [x] Task 2: Add `GET /api/campaigns/:id`
- [x] Task 3: Retire `DELETE /api/campaigns/:id`

### Checkpoint: Campaign wire shape
- [ ] `npm run typecheck` clean
- [ ] List, detail, create and update all carry `progress_pct`
- [ ] A goal-less campaign reports `progress_pct: null`
- [ ] `DELETE /api/campaigns/:id` returns 404

### Phase 2: Member detail and retirement

- [x] Task 4: Add booking history summary to `GET /api/members/:id`
- [x] Task 5: Retire `POST /api/members` and `PATCH /api/members/:id/renewal`

### Checkpoint: Member detail
- [ ] Full suite passes with no row-count drift
- [ ] A member with no bookings reports zeros, not an empty object
- [ ] The retired member routes return 404

### Phase 3: Frontend

- [x] Task 6: Surface `progress_pct` in the donation UI
- [x] Task 7: Realign the AdminDashboard onto the contract surface

### Checkpoint: Frontend
- [ ] Frontend typecheck and production build pass
- [ ] No frontend caller references a retired route
- [ ] Review with human before proceeding

### Phase 4: Regression cover

- [x] Task 8: Contract tests for all changes

### Checkpoint: Complete
- [ ] `npm test` passes
- [ ] Frontend typecheck and production build pass
- [ ] Live row counts unchanged after a green run
- [ ] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `progress_pct` rounded inconsistently across endpoints | Low | Single shaper; one test asserts the same campaign yields the same value from list and detail |
| Member detail response shape breaks a caller | Low | Verified no frontend caller of `GET /members/:id`; only `PATCH /members/:id/role` and `/renewal` used that path, and `/renewal` is being retired |
| Removing create-member leaves no way to add a member | Med | Accepted: the contract has no member-create route and offers staff invite instead. Members self-register via Supabase signup |
| Renewal now needs a tier and a date the old button never asked for | Med | The dashboard collects both; the old flow silently assumed 30 days |
| `goal_amount` of 0 | Low | Impossible today (`check (goal_amount is null or goal_amount > 0)`) but the shaper still guards, since a zero goal is a divide by zero |

## Open Questions

None outstanding. Resolved this round:

- `DELETE /api/campaigns/:id` — retired.
- `POST /api/members` and `PATCH /api/members/:id/renewal` — retired;
  AdminDashboard realigned onto `PATCH /api/members/:id/tier`.
- `progress_pct` rounding — whole percentage.

# Remaining contract gaps: campaigns, member detail, and retiring off-contract routes

Source: `tasks/plan.md`. Authoritative spec: `RCH_API_CONTRACT.md`.

## Task 1: Add `progress_pct` to every campaign response

**Description:** The contract lists `progress_pct` among the campaign fields
(`RCH_API_CONTRACT.md:69`) and it exists nowhere in the codebase. Four endpoints
return campaigns, so the arithmetic belongs in one shaper.

**Acceptance criteria:**
- [ ] List, detail, create and update responses all carry `progress_pct`
- [ ] Whole percentage, rounded to the nearest integer
- [ ] A campaign with `goal_amount: null` reports `progress_pct: null`, not 0
- [ ] `goal_amount: 0` does not divide by zero
- [ ] Overfunded campaigns report more than 100, not clamped

**Verification:**
- [ ] Tests pass: `npm test` in `riverside-backend`
- [ ] Build succeeds: `npm run typecheck`
- [ ] Manual check: `curl` the list and confirm the field is present

**Dependencies:** None

**Files likely touched:**
- `riverside-backend/src/routes/campaigns.routes.ts`

**Estimated scope:** XS: 1 file

---

## Task 2: Add `GET /api/campaigns/:id`

**Description:** Required by the contract (line 70) and absent from the code.
Public, single-campaign detail, same shape as a list item.

**Acceptance criteria:**
- [ ] Returns the campaign with the same fields as the list, including `progress_pct`
- [ ] Public, no token required
- [ ] Unknown id returns 404, not an empty object
- [ ] A deactivated campaign still resolves, matching how `PATCH` reaches it

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Manual check: fetch a seeded campaign id with no Authorization header

**Dependencies:** Task 1 (reuses the `withProgress` shaper)

**Files likely touched:**
- `riverside-backend/src/routes/campaigns.routes.ts`

**Estimated scope:** XS: 1 file

---

## Task 3: Retire `DELETE /api/campaigns/:id`

**Description:** Not in the contract, and no frontend caller. Deleting a
campaign also destroys its donation history, which the soft-deactivate used
elsewhere avoids. Retire it the way the `/api/admin` stubs were retired.

**Acceptance criteria:**
- [ ] `DELETE /api/campaigns/:id` returns 404
- [ ] The handler, its schemas and any now-unused imports are gone
- [ ] No frontend caller references it

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Manual check: `curl -X DELETE` returns the standard 404 body

**Dependencies:** None

**Files likely touched:**
- `riverside-backend/src/routes/campaigns.routes.ts`
- `riverside-backend/src/app.ts` (only if a mount becomes empty — it does not)
- `riverside-backend/test/auth-membership.test.ts` (retire the FK-conflict test)

**Estimated scope:** XS: 1-2 files

---

## Checkpoint: Campaign wire shape

- [ ] `npm run typecheck` clean
- [ ] List, detail, create and update all carry `progress_pct`
- [ ] A goal-less campaign reports `progress_pct: null`
- [ ] `DELETE /api/campaigns/:id` returns 404
- [ ] Review with human before proceeding

---

## Task 4: Add booking history summary to `GET /api/members/:id`

**Description:** The contract asks for "profile + booking history summary"
(line 19); the handler returns the bare profile. No frontend caller reads this
endpoint. The summary reuses the reports `by_status` array shape.

**Acceptance criteria:**
- [ ] Response carries the profile fields plus a `booking_history` summary
- [ ] Summary reports `total`, `upcoming_count`, `past_count` and `by_status`
      as `{status, count}` for all four statuses, zeros included
- [ ] `upcoming_count` and `past_count` partition the total, matching
      `GET /api/bookings/mine`
- [ ] A member with no bookings reports zeros and an empty list, never `null`
- [ ] Still staff/admin only

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Manual check: fetch a seeded member with and without bookings

**Dependencies:** None

**Files likely touched:**
- `riverside-backend/src/routes/members.routes.ts`

**Estimated scope:** XS: 1 file

---

## Task 5: Retire `POST /api/members` and `PATCH /api/members/:id/renewal`

**Description:** Neither is in the contract. `/renewal` duplicates
`PATCH /api/members/:id/tier`, which the contract calls the manual renewal path.
Creating a member is not a contract capability either; members self-register via
Supabase signup and staff are onboarded with `POST /api/staff/invite`.

**Acceptance criteria:**
- [ ] Both routes return 404
- [ ] `MemberCreateSchema` is gone if nothing else uses it
- [ ] The FK-conflict behaviour that justified campaign deletion is no longer
      reachable, so its test is retired rather than left failing

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Manual check: `curl` both retired paths

**Dependencies:** None

**Files likely touched:**
- `riverside-backend/src/routes/members.routes.ts`
- `riverside-backend/src/validation/schemas.ts`
- `riverside-backend/test/auth-membership.test.ts`

**Estimated scope:** S: 2-3 files

---

## Checkpoint: Member detail

- [ ] Full suite passes with no row-count drift
- [ ] A member with no bookings reports zeros, not an empty object
- [ ] The retired member routes return 404
- [ ] Review with human before proceeding

---

## Task 6: Surface `progress_pct` in the donation UI

**Description:** `CampaignRecord` has no `progress_pct`, so the donation page
cannot show how far a campaign has come. Follow the `frontend-ui-engineering`
skill: real loading and empty states, a labelled bar readable by assistive tech,
no colour-only signalling.

**Acceptance criteria:**
- [ ] `CampaignRecord` carries `progress_pct: number | null`
- [ ] The donation page shows progress toward the goal, or a neutral state when
      the campaign has no goal set
- [ ] The bar is exposed with `role="progressbar"` and `aria-valuenow`, or a
      plain text fallback when there is no goal
- [ ] Overfunded campaigns are described in words, not just a bar past 100

**Verification:**
- [ ] `npx tsc -p tsconfig.json --noEmit` clean in `riverside-frontend`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: render with a funded, unfunded and overfunded campaign

**Dependencies:** Task 1

**Files likely touched:**
- `riverside-frontend/src/types.ts`
- `riverside-frontend/src/pages/DonatePage.tsx`

**Estimated scope:** S: 2 files

---

## Task 7: Realign the AdminDashboard onto the contract surface

**Description:** The dashboard calls two retired routes. Remove the
create-member form, and replace the renewal button — which called `/renewal` with
an empty body and guessed a 30-day extension in the client — with an explicit
tier-and-duration control posting to `PATCH /api/members/:id/tier`. Follow the
`frontend-ui-engineering` skill for the replacement control.

**Acceptance criteria:**
- [ ] No reference to `POST /members` or `/members/:id/renewal` remains
- [ ] Renewal posts an explicit `membership_tier` and `membership_expires_at`
- [ ] The renewal control is keyboard reachable and labelled, not a bare click
- [ ] Tier choices match the contract's `membership_tier` values
- [ ] The client no longer assumes a 30-day term in its optimistic update
- [ ] The donated amounts are formatted from the real response, not guessed

**Verification:**
- [ ] `npx tsc -p tsconfig.json --noEmit` clean
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: renew a member, reload, confirm the new expiry persisted

**Dependencies:** Task 5

**Files likely touched:**
- `riverside-frontend/src/pages/AdminDashboard.tsx`

**Estimated scope:** M: 3-5 files

---

## Checkpoint: Frontend

- [ ] Frontend typecheck and production build pass
- [ ] No frontend caller references a retired route
- [ ] Review with human before proceeding

---

## Task 8: Contract tests for all changes

**Description:** Pin the behaviour so a later change cannot quietly drop it.

**Acceptance criteria:**
- [ ] `progress_pct` asserted for a funded, goal-less and overfunded campaign
- [ ] List and detail return identical `progress_pct` for the same campaign
- [ ] `GET /api/campaigns/:id` 200 for a known id, 404 for an unknown one
- [ ] All three retired routes return 404
- [ ] Member summary counts reconcile: total equals the sum of `by_status`, and
      `upcoming_count + past_count` equals total
- [ ] A member with no bookings is covered

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Live row counts match their pre-run values afterwards

**Dependencies:** Tasks 1, 2, 3, 4, 5

**Files likely touched:**
- `riverside-backend/test/auth-membership.test.ts`

**Estimated scope:** S: 1-2 files

---

## Checkpoint: Complete

- [ ] `npm test` passes
- [ ] Frontend typecheck and production build pass
- [ ] Live row counts unchanged after a green run
- [ ] Ready for review

---

## Deferred, not decided here

- [ ] Reactivate paths for deactivated staff and resources — neither the contract
      nor the code has one, so a mistake needs direct DB access
- [ ] AdminDashboard donation table is still a single unbounded fetch
- [ ] `npm run lint` has never worked: no ESLint config exists
- [ ] `RCH_API_CONTRACT.md` is still untracked
- [ ] MemberDashboard and StaffDashboard remain single files over 200 lines

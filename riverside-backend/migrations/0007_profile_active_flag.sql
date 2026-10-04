-- ============================================================================
-- 0007: deactivate a profile without deleting its history.
--
-- The contract has PATCH /api/staff/:id/deactivate return {id, active: false}
-- and describes it as revoking access without deleting history, so the flag
-- lives on profiles rather than being derived from role or from a deleted
-- auth.users row.
--
-- NOT NULL DEFAULT TRUE backfills every existing row in one step, so no
-- separate UPDATE is needed and re-running this is a no-op.
-- ============================================================================

alter table public.profiles
  add column if not exists active boolean not null default true;

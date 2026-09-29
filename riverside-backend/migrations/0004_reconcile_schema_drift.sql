-- ============================================================================
-- 0004: reconcile live schema drift.
--
-- The deployed database carries two changes that migration 0001 does not
-- create, so a fresh environment built from 0001-0003 would differ from
-- production. Both are assertions here, not opinionated changes.
--
-- 1. profiles.membership_tier exists (default 'free') and is read by the
--    auth, members, and profile routes.
-- 2. handle_new_user() also grants a 30-day membership, so self-signups
--    arrive with an expiry instead of a permanent null.
-- ============================================================================

alter table public.profiles
  add column if not exists membership_tier text not null default 'free';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, membership_tier, membership_expires_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'free',
    now() + interval '30 days'
  );
  return new;
end;
$$;

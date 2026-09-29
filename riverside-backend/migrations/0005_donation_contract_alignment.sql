-- ============================================================================
-- 0005: bring donations in line with the API contract.
--
-- The contract defines:
--   type   ("one_off" | "pledge_intent")
--   status ("paid" | "pending_followup" | "followed_up" | "cancelled")
-- and a POST /api/donations response of {id, status, receipt_reference}.
--
-- The deployed schema instead offered donation_type ('one_off','monthly') and
-- donation_status ('pending_followup','followed_up'), had no
-- receipt_reference, and maintained campaign.current_amount from an
-- insert-only trigger, so a deleted donation left the total inflated forever.
--
-- Safe to run: at time of writing no donation uses type 'monthly' and every
-- existing status is 'followed_up', both of which survive the enum recreation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- donation_type: drop 'monthly', add 'pledge_intent'
-- ---------------------------------------------------------------------------
alter table public.donations alter column type drop default;

create type public.donation_type_new as enum ('one_off', 'pledge_intent');

alter table public.donations
  alter column type type public.donation_type_new
  using (type::text)::public.donation_type_new;

drop type public.donation_type;
alter type public.donation_type_new rename to donation_type;

alter table public.donations alter column type set default 'one_off';

-- ---------------------------------------------------------------------------
-- donation_status: add 'paid' and 'cancelled'
-- ---------------------------------------------------------------------------
alter table public.donations alter column status drop default;

create type public.donation_status_new as enum (
  'paid', 'pending_followup', 'followed_up', 'cancelled'
);

alter table public.donations
  alter column status type public.donation_status_new
  using (status::text)::public.donation_status_new;

drop type public.donation_status;
alter type public.donation_status_new rename to donation_status;

-- one_off donations settle immediately; pledge_intent ones are followed up.
alter table public.donations alter column status set default 'paid';

-- ---------------------------------------------------------------------------
-- receipt_reference: required by the documented POST response
-- ---------------------------------------------------------------------------
alter table public.donations
  add column if not exists receipt_reference text;

-- Backfill so no existing row reports a null receipt reference. The
-- application mints new references on insert.
update public.donations
   set receipt_reference = 'RCH-LEGACY-' || upper(substr(replace(id::text, '-', ''), 1, 10))
 where receipt_reference is null;

-- ---------------------------------------------------------------------------
-- campaign.current_amount must survive inserts, updates AND deletes.
--
-- The previous trigger fired only on insert, so any later delete permanently
-- inflated the campaign. The same function now handles all three operations
-- by applying the exact delta, which keeps current_amount equal to the sum of
-- the campaign's donations.
-- ---------------------------------------------------------------------------
create or replace function public.apply_donation_to_campaign()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.campaigns
       set current_amount = current_amount + new.amount
     where id = new.campaign_id;

  elsif tg_op = 'DELETE' then
    -- greatest() guards the current_amount >= 0 check constraint.
    update public.campaigns
       set current_amount = greatest(0, current_amount - old.amount)
     where id = old.campaign_id;

  elsif tg_op = 'UPDATE' then
    if new.campaign_id = old.campaign_id then
      if new.amount is distinct from old.amount then
        update public.campaigns
           set current_amount = greatest(0, current_amount + (new.amount - old.amount))
         where id = new.campaign_id;
      end if;
    else
      update public.campaigns
         set current_amount = greatest(0, current_amount - old.amount)
       where id = old.campaign_id;
      update public.campaigns
         set current_amount = current_amount + new.amount
       where id = new.campaign_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_donation_created on public.donations;

create trigger on_donation_created
  after insert or update or delete on public.donations
  for each row execute function public.apply_donation_to_campaign();

-- ---------------------------------------------------------------------------
-- One-off reconciliation: current_amount had drifted from the true sum of
-- donations. Recompute every campaign from its donations.
-- ---------------------------------------------------------------------------
update public.campaigns c
   set current_amount = coalesce((
         select sum(d.amount) from public.donations d where d.campaign_id = c.id
       ), 0);

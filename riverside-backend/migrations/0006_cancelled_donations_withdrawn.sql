-- ============================================================================
-- 0006: a cancelled donation is withdrawn money, not a contribution.
--
-- apply_donation_to_campaign (0005) added the amount on every insert regardless
-- of status, so a donation that ends up cancelled still counts toward the
-- campaign's public progress total and stays there forever. A cancelled pledge
-- is money that was never given: it must never enter the total, and cancelling
-- a donation that was already counted has to take it back out again.
--
-- No route can set status = 'cancelled' today -- donations.routes.ts only
-- produces paid, pending_followup and followed_up -- so this is a latent bug
-- that surfaces the moment a cancellation path is added, and it equally governs
-- a direct correction of a donation's status in the database.
--
-- Safe to run, and safe to re-run: the recompute at the end rebuilds
-- current_amount from the donations, so the totals are correct whether or not
-- the previous trigger ever ran.
-- ============================================================================

create or replace function public.apply_donation_to_campaign()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  leaving  numeric(12,2) := 0;  -- amount that stops counting
  arriving numeric(12,2) := 0;  -- amount that starts counting
begin
  -- The whole trigger is the difference between what the old row was worth and
  -- what the new row is worth, where a cancelled row is worth nothing. new is
  -- unset on DELETE and old is unset on INSERT, so each side is guarded by
  -- tg_op before it is read.
  if tg_op <> 'INSERT' and old.status <> 'cancelled' then
    leaving := old.amount;
  end if;

  if tg_op <> 'DELETE' and new.status <> 'cancelled' then
    arriving := new.amount;
  end if;

  -- Same campaign: only the net difference is applied, and only if there is one.
  if tg_op = 'UPDATE' and new.campaign_id = old.campaign_id then
    if arriving <> leaving then
      -- greatest() guards the current_amount >= 0 check constraint.
      update public.campaigns
         set current_amount = greatest(0, current_amount + (arriving - leaving))
       where id = new.campaign_id;
    end if;
    return new;
  end if;

  if leaving > 0 then
    update public.campaigns
       set current_amount = greatest(0, current_amount - leaving)
     where id = old.campaign_id;
  end if;

  if arriving > 0 then
    update public.campaigns
       set current_amount = current_amount + arriving
     where id = new.campaign_id;
  end if;

  return coalesce(new, old);
end;
$$;

-- Recompute every campaign from the donations that actually count.
update public.campaigns c
   set current_amount = coalesce((
         select sum(d.amount)
           from public.donations d
          where d.campaign_id = c.id
            and d.status <> 'cancelled'
       ), 0);

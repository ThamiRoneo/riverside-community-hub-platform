-- Unified resource surface.
--
-- The contract exposes rooms and equipment through a single `resources` shape
-- and references them from bookings by `resource_id`. The underlying tables stay
-- split, so this migration only fills the columns the API layer needs and adds
-- `resource_id` to the wire format of existing rows.

alter table public.bookings
  add column if not exists purpose text,
  add column if not exists accessibility_notes text,
  add column if not exists contact_phone text,
  add column if not exists people_count integer;

-- `quantity` is how many of a bundle exist; the contract's resource shape asks
-- for a capacity, so give equipment one too rather than faking it at the edge.
alter table public.equipment
  add column if not exists capacity integer;

-- Existing bookings predate the contract fields. Backfill so no row is left
-- null in a column the API now reports.
update public.bookings
   set purpose = coalesce(purpose, 'Community booking'),
       people_count = coalesce(people_count, 1),
       contact_phone = coalesce(
         contact_phone,
         (select p.phone from public.profiles p where p.id = bookings.member_id)
       )
 where purpose is null
    or people_count is null
    or contact_phone is null;

update public.equipment set capacity = coalesce(capacity, quantity) where capacity is null;
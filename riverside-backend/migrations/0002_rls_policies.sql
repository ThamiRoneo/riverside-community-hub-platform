-- ============================================================================
-- Row Level Security. Roles come from public.profiles, synced with auth.users.
-- NOTE: the Express backend uses the service-role key (bypasses RLS) for
-- privileged writes like role changes; these policies protect direct
-- client-side access as the required second layer.
-- ============================================================================

-- Helper: current user's role. security definer avoids RLS recursion.
create or replace function public.current_role()
returns public.user_role
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.current_role() in ('staff', 'admin');
$$;

alter table public.profiles   enable row level security;
alter table public.facilities enable row level security;
alter table public.equipment  enable row level security;
alter table public.bookings   enable row level security;
alter table public.campaigns  enable row level security;
alter table public.donations  enable row level security;
alter table public.programmes enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_or_staff" on public.profiles
  for select using (id = auth.uid() or public.is_staff_or_admin());

-- Members may edit their own profile, but NEVER the role column
-- (role changes go through PATCH /api/members/:id/role with re-auth).
revoke update (role) on public.profiles from authenticated;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- facilities & equipment: readable by everyone, writable by staff/admin
-- ---------------------------------------------------------------------------
create policy "facilities_read"   on public.facilities for select using (true);
create policy "facilities_write"  on public.facilities for all
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy "equipment_read"    on public.equipment for select using (true);
create policy "equipment_write"   on public.equipment for all
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create policy "bookings_insert_member" on public.bookings
  for insert with check (
    member_id = auth.uid() and public.current_role() = 'member'
  );
create policy "bookings_select_own_or_staff" on public.bookings
  for select using (member_id = auth.uid() or public.is_staff_or_admin());
create policy "bookings_staff_update" on public.bookings
  for update using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- ---------------------------------------------------------------------------
-- campaigns & programmes: public read, admin write
-- ---------------------------------------------------------------------------
create policy "campaigns_read"  on public.campaigns for select using (true);
create policy "campaigns_admin" on public.campaigns for all
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "programmes_read"  on public.programmes for select using (true);
create policy "programmes_admin" on public.programmes for all
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- donations: staff/admin see all; members see their own (non-anonymous)
-- ---------------------------------------------------------------------------
create policy "donations_select_staff" on public.donations
  for select using (public.is_staff_or_admin());
create policy "donations_select_own" on public.donations
  for select using (donor_id = auth.uid() and anonymous = false);
create policy "donations_insert" on public.donations
  for insert with check (
    -- public visitors may donate as guests (donor_id null, filled by API);
    -- members donate as themselves
    donor_id is null or donor_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Storage buckets (create in dashboard or: insert into storage.buckets ...)
--   avatars            — public read, owner write
--   programme-images   — public read, admin write
--   receipts           — private, staff/admin read
-- ---------------------------------------------------------------------------

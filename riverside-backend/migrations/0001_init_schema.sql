create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;

create type user_role as enum ('visitor', 'member', 'staff', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'member',
  membership_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table resources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create type booking_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table bookings (
  id uuid primary key default uuid_generate_v4(),
  resource_id uuid not null references resources(id),
  member_id uuid not null references profiles(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  status booking_status not null default 'pending',
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_range check (end_time > start_time),
  exclude using gist (
    resource_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status in ('pending', 'approved'))
);

create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  goal_amount numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create type donation_type as enum ('one_off', 'pledge');
create type donation_status as enum ('pending', 'completed', 'pending_followup', 'followed_up', 'failed');

create table donations (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id),
  donor_id uuid references profiles(id),
  amount numeric(12,2) not null,
  type donation_type not null default 'one_off',
  status donation_status not null default 'pending',
  donor_name text,
  donor_email text,
  donor_phone text,
  anonymous boolean not null default false,
  receipt_opt_in boolean not null default false,
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table programmes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table bookings enable row level security;
alter table donations enable row level security;
alter table resources enable row level security;
alter table campaigns enable row level security;
alter table programmes enable row level security;

create policy "profiles_self_select" on profiles for select
  using (auth.uid() = id or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('staff','admin')
  ));
create policy "profiles_self_update" on profiles for update
  using (auth.uid() = id);

create policy "resources_public_select" on resources for select using (true);
create policy "campaigns_public_select" on campaigns for select using (true);

create policy "bookings_owner_select" on bookings for select
  using (member_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('staff','admin')
  ));
create policy "bookings_owner_insert" on bookings for insert
  with check (member_id = auth.uid());
create policy "bookings_staff_update" on bookings for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

create policy "donations_owner_select" on donations for select
  using (donor_id = auth.uid() or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('staff','admin')
  ));
create policy "donations_public_insert" on donations for insert with check (true);
create policy "donations_staff_update" on donations for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

create policy "programmes_staff_select" on programmes for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

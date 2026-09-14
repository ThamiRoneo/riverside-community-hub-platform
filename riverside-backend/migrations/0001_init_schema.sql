create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";   -- required for exclusion constraints

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role      as enum ('member', 'staff', 'admin');
create type public.booking_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.donation_type  as enum ('one_off', 'monthly');
-- Donation follow-up state machine (see API contract §Donations):
-- pending_followup -> followed_up  (only transition; enforced again in Express)
create type public.donation_status as enum ('pending_followup', 'followed_up');

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text not null,
  phone                 text,
  role                  public.user_role not null default 'member',
  membership_expires_at timestamptz,          -- drives the "expiring soon" flag (30d out)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Auto-create a profile row whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Facilities & equipment (bookable resources)
-- ---------------------------------------------------------------------------
create table public.facilities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  capacity    integer check (capacity is null or capacity > 0),
  hourly_rate numeric(10,2) not null default 0 check (hourly_rate >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.equipment (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  quantity    integer not null default 1 check (quantity > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- Conflict prevention, layer 1 (DB): a resource can never have two
-- APPROVED bookings that overlap. Layer 2 (Express) re-checks at creation
-- and at staff approval, because overlapping PENDING requests may coexist.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.profiles(id) on delete cascade,
  facility_id  uuid references public.facilities(id),
  equipment_id uuid references public.equipment(id),
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  status       public.booking_status not null default 'pending',
  staff_note   text,                          -- mandatory on reject (enforced in API, 400)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint booking_time_sane    check (end_at > start_at),
  constraint booking_one_resource check (num_nonnulls(facility_id, equipment_id) = 1)
);

alter table public.bookings
  add constraint no_double_booking_facility
  exclude using gist (
    facility_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status = 'approved' and facility_id is not null);

alter table public.bookings
  add constraint no_double_booking_equipment
  exclude using gist (
    equipment_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status = 'approved' and equipment_id is not null);

-- ---------------------------------------------------------------------------
-- Campaigns & donations
-- current_amount is maintained by trigger ONLY (never written via API),
-- to avoid race conditions between simultaneous donations.
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  goal_amount    numeric(12,2) check (goal_amount is null or goal_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.donations (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns(id),
  donor_id       uuid references public.profiles(id) on delete set null, -- null = guest donor
  type           public.donation_type   not null default 'one_off',
  status         public.donation_status not null default 'pending_followup',
  amount         numeric(12,2) not null check (amount > 0),
  donor_name     text,
  donor_email    text,
  donor_phone    text,
  anonymous      boolean not null default false,
  receipt_opt_in boolean not null default false,
  staff_note     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.apply_donation_to_campaign()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.campaigns
     set current_amount = current_amount + new.amount
   where id = new.campaign_id;
  return new;
end;
$$;

create trigger on_donation_created
  after insert on public.donations
  for each row execute function public.apply_donation_to_campaign();

-- ---------------------------------------------------------------------------
-- Programmes (landing page "Youth programmes" + admin Programmes tab)
-- ---------------------------------------------------------------------------
create table public.programmes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  age_range     text,             -- e.g. '12-17'
  schedule_info text,             -- e.g. 'Tue & Thu, 16:00-18:00'
  active        boolean not null default true,
  image_url     text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated  before update on public.profiles  for each row execute function public.touch_updated_at();
create trigger trg_bookings_updated  before update on public.bookings  for each row execute function public.touch_updated_at();
create trigger trg_donations_updated before update on public.donations for each row execute function public.touch_updated_at();

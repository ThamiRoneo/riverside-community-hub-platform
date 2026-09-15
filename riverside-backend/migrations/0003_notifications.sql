create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

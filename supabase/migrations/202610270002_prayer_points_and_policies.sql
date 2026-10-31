create table if not exists public.daily_prayer_points (
  id uuid primary key default gen_random_uuid(),
  prayer_point text not null,
  prayer_date date not null default current_date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists daily_prayer_points_date_idx
  on public.daily_prayer_points(prayer_date, created_at desc);

alter table public.daily_prayer_points enable row level security;

create or replace view public.daily_prayer_points_public with (security_invoker = false) as
  select id, prayer_point, prayer_date, created_at
  from public.daily_prayer_points
  where prayer_date = current_date;

grant select on public.daily_prayer_points to authenticated;
grant insert, update, delete on public.daily_prayer_points to authenticated;
grant select on public.daily_prayer_points_public to anon, authenticated;

drop policy if exists "member creates own verses" on public.daily_verses;
drop policy if exists "member edits own verses" on public.daily_verses;
drop policy if exists "member deletes own verses" on public.daily_verses;

drop policy if exists "prayer director reads verses" on public.daily_verses;
drop policy if exists "prayer director creates verses" on public.daily_verses;
drop policy if exists "prayer director edits own verses" on public.daily_verses;
drop policy if exists "prayer director deletes own verses" on public.daily_verses;
create policy "prayer director reads verses" on public.daily_verses
  for select to authenticated using (public.current_app_role() = 'prayer_director');
create policy "prayer director creates verses" on public.daily_verses
  for insert to authenticated with check (member_id = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director edits own verses" on public.daily_verses
  for update to authenticated using (member_id = auth.uid() and public.current_app_role() = 'prayer_director')
  with check (member_id = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director deletes own verses" on public.daily_verses
  for delete to authenticated using (member_id = auth.uid() and public.current_app_role() = 'prayer_director');

drop policy if exists "public reads today's prayer points" on public.daily_prayer_points;
drop policy if exists "prayer director reads prayer points" on public.daily_prayer_points;
drop policy if exists "prayer director creates prayer points" on public.daily_prayer_points;
drop policy if exists "prayer director edits own prayer points" on public.daily_prayer_points;
drop policy if exists "prayer director deletes own prayer points" on public.daily_prayer_points;
create policy "public reads today's prayer points" on public.daily_prayer_points
  for select to anon, authenticated using (prayer_date = current_date);
create policy "prayer director reads prayer points" on public.daily_prayer_points
  for select to authenticated using (public.current_app_role() = 'prayer_director');
create policy "prayer director creates prayer points" on public.daily_prayer_points
  for insert to authenticated with check (created_by = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director edits own prayer points" on public.daily_prayer_points
  for update to authenticated using (created_by = auth.uid() and public.current_app_role() = 'prayer_director')
  with check (created_by = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director deletes own prayer points" on public.daily_prayer_points
  for delete to authenticated using (created_by = auth.uid() and public.current_app_role() = 'prayer_director');

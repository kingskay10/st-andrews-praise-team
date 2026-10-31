-- St Andrews CCAP Praise Team schema for Supabase/PostgreSQL.
-- Run in the Supabase SQL editor. Never expose a service-role key to the browser.
create extension if not exists pgcrypto;

create type public.app_role as enum ('chair', 'secretary', 'music_director', 'band_director', 'prayer_director', 'member');
create type public.report_status as enum ('draft', 'pending', 'published');
create type public.gallery_source_type as enum ('member', 'event');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  marital_status text check (marital_status in ('single', 'married')),
  phone text,
  social_media text,
  location text,
  position text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date timestamptz not null,
  location text,
  poster_path text,
  attachment_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  contributions numeric(10,2) not null default 0 check (contributions >= 0),
  offerings numeric(10,2) not null default 0 check (offerings >= 0),
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, month)
);

create table public.department_reports (
  id uuid primary key default gen_random_uuid(),
  department public.app_role not null check (department in ('secretary', 'music_director', 'band_director')),
  title text not null,
  summary text not null,
  content text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status public.report_status not null default 'draft',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((published and status = 'published') or (not published and status <> 'published'))
);

create table public.department_music (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  rehearsal_date timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.department_band (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assignments text,
  equipment text,
  schedule_notes text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.member_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  created_at timestamptz not null default now()
);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  source_type public.gallery_source_type not null default 'member',
  source_id uuid,
  image_path text not null,
  storage_bucket text not null default 'member-media'
    check (storage_bucket in ('event-media', 'member-media', 'gallery-public')),
  caption text,
  created_at timestamptz not null default now()
);

create table public.gallery_photo_likes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.gallery_photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, user_id)
);

create table public.gallery_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.gallery_photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.gallery_comments(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now()
);

create table public.gallery_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.gallery_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table public.daily_verses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  verse_text text not null,
  posted_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.daily_prayer_points (
  id uuid primary key default gen_random_uuid(),
  prayer_point text not null,
  prayer_date date not null default current_date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index events_event_date_idx on public.events(event_date);
create index finance_member_month_idx on public.finance_records(member_id, month);
create index reports_published_idx on public.department_reports(published, published_at desc);
create index updates_published_idx on public.updates(published_at desc);
create index gallery_photos_created_idx on public.gallery_photos(created_at desc);
create index daily_prayer_points_date_idx on public.daily_prayer_points(prayer_date, created_at desc);

-- Public-safe projections avoid granting anonymous access to member profiles.
create view public.daily_verses_public with (security_invoker = false) as
  select dv.id, dv.verse_text, dv.posted_on, dv.created_at, p.name as member_name
  from public.daily_verses dv
  join public.profiles p on p.id = dv.member_id
  where dv.posted_on = current_date;

create view public.daily_prayer_points_public with (security_invoker = false) as
  select id, prayer_point, prayer_date, created_at
  from public.daily_prayer_points
  where prayer_date = current_date;

create view public.updates_public with (security_invoker = false) as
  select u.id, u.title, u.content, u.published_at, u.created_at, p.name as author_name
  from public.updates u
  join public.profiles p on p.id = u.author_id
  where u.published_at is not null;

create view public.events_public with (security_invoker = false) as
  select id, title, description, event_date, location, poster_path, attachment_path, created_at, updated_at
  from public.events;

create view public.gallery_public with (security_invoker = false) as
  select id, image_path, storage_bucket, caption, created_at
  from public.gallery_photos
  where storage_bucket in ('event-media', 'gallery-public');

create view public.department_reports_public with (security_invoker = false) as
  select id, department, title, summary, content, status, published, published_at, created_at, updated_at
  from public.department_reports
  where published = true and status = 'published';

create function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$ select role from public.roles where user_id = auth.uid() $$;

create function public.is_team_member()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.roles where user_id = auth.uid()) $$;

create function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.email);
  insert into public.roles (user_id, role) values (new.id, 'member');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.events enable row level security;
alter table public.updates enable row level security;
alter table public.finance_records enable row level security;
alter table public.department_reports enable row level security;
alter table public.department_music enable row level security;
alter table public.department_band enable row level security;
alter table public.member_photos enable row level security;
alter table public.gallery_photos enable row level security;
alter table public.gallery_photo_likes enable row level security;
alter table public.gallery_comments enable row level security;
alter table public.gallery_comment_likes enable row level security;
alter table public.daily_verses enable row level security;
alter table public.daily_prayer_points enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.events, public.department_reports, public.updates, public.daily_verses to authenticated;
grant select on public.daily_prayer_points to authenticated;
grant select on public.events_public, public.department_reports_public, public.daily_verses_public, public.daily_prayer_points_public, public.updates_public, public.gallery_public to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.roles, public.events, public.updates, public.finance_records, public.department_reports, public.department_music, public.department_band, public.member_photos, public.gallery_photos, public.gallery_photo_likes, public.gallery_comments, public.gallery_comment_likes, public.daily_verses, public.daily_prayer_points to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant update (name, marital_status, phone, social_media, location, position, photo_path) on public.profiles to authenticated;

-- Profiles: members can read the team directory; only the chair edits other profiles.
create policy "team can read profiles" on public.profiles for select to authenticated using (public.is_team_member());
create policy "member edits own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "chair manages profiles" on public.profiles for all to authenticated using (public.current_app_role() = 'chair') with check (public.current_app_role() = 'chair');

-- Roles are hidden from anonymous visitors; only the chair can assign or change roles.
create policy "team can read roles" on public.roles for select to authenticated using (public.is_team_member());
create policy "chair manages roles" on public.roles for all to authenticated using (public.current_app_role() = 'chair') with check (public.current_app_role() = 'chair');

-- Events are public; only chair maintains them.
create policy "public reads events" on public.events for select to anon, authenticated using (true);
create policy "chair manages events" on public.events for all to authenticated using (public.current_app_role() = 'chair') with check (public.current_app_role() = 'chair');

-- Updates are visible publicly only after publication. Chair authors and manages them.
create policy "public reads published updates" on public.updates for select to anon, authenticated using (published_at is not null);
create policy "chair manages updates" on public.updates for all to authenticated using (public.current_app_role() = 'chair') with check (public.current_app_role() = 'chair' and author_id = auth.uid());

-- Finance is secretary-only, including reads.
create policy "secretary manages finance" on public.finance_records for all to authenticated using (public.current_app_role() = 'secretary') with check (public.current_app_role() = 'secretary' and recorded_by = auth.uid());

-- Reports: public sees only published reports; each department owns its drafts; chair reviews and publishes.
create policy "public reads published reports" on public.department_reports for select to anon, authenticated using (published = true and status = 'published');
create policy "department reads own reports" on public.department_reports for select to authenticated using (department = public.current_app_role() or public.current_app_role() = 'chair');
create policy "department creates own reports" on public.department_reports for insert to authenticated with check (created_by = auth.uid() and department = public.current_app_role() and department in ('secretary', 'music_director', 'band_director') and not published and status in ('draft', 'pending'));
create policy "department edits own unpublished reports" on public.department_reports for update to authenticated using (created_by = auth.uid() and department = public.current_app_role() and not published) with check (created_by = auth.uid() and department = public.current_app_role() and not published and status in ('draft', 'pending'));
create policy "chair publishes reports" on public.department_reports for update to authenticated using (public.current_app_role() = 'chair') with check (public.current_app_role() = 'chair' and ((published and status = 'published') or (not published and status in ('draft', 'pending'))));

-- Department plans are visible and writable only to their owning director.
create policy "music director reads music plans" on public.department_music for select to authenticated using (public.current_app_role() = 'music_director');
create policy "music director creates music plans" on public.department_music for insert to authenticated with check (public.current_app_role() = 'music_director' and created_by = auth.uid());
create policy "music director edits own music plans" on public.department_music for update to authenticated using (public.current_app_role() = 'music_director' and created_by = auth.uid()) with check (public.current_app_role() = 'music_director' and created_by = auth.uid());
create policy "music director deletes own music plans" on public.department_music for delete to authenticated using (public.current_app_role() = 'music_director' and created_by = auth.uid());
create policy "band director reads band plans" on public.department_band for select to authenticated using (public.current_app_role() = 'band_director');
create policy "band director creates band plans" on public.department_band for insert to authenticated with check (public.current_app_role() = 'band_director' and created_by = auth.uid());
create policy "band director edits own band plans" on public.department_band for update to authenticated using (public.current_app_role() = 'band_director' and created_by = auth.uid()) with check (public.current_app_role() = 'band_director' and created_by = auth.uid());
create policy "band director deletes own band plans" on public.department_band for delete to authenticated using (public.current_app_role() = 'band_director' and created_by = auth.uid());

-- Personal photos are private to the owner, except shared gallery views for team members.
create policy "team reads gallery photos" on public.gallery_photos for select to authenticated using (public.is_team_member());
create policy "member creates own gallery photos" on public.gallery_photos for insert to authenticated with check (uploader_id = auth.uid() and source_type = 'member');
create policy "chair adds own event posters to gallery" on public.gallery_photos for insert to authenticated with check (uploader_id = auth.uid() and source_type = 'event' and public.current_app_role() = 'chair' and exists (select 1 from public.events where id = source_id and created_by = auth.uid()));
create policy "member edits own gallery photos" on public.gallery_photos for update to authenticated using (uploader_id = auth.uid()) with check (uploader_id = auth.uid());
create policy "member deletes own gallery photos" on public.gallery_photos for delete to authenticated using (uploader_id = auth.uid());
create policy "member manages own photos" on public.member_photos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Team-only gallery interactions; a user can change only their own likes/comments.
create policy "team reads photo likes" on public.gallery_photo_likes for select to authenticated using (public.is_team_member());
create policy "member manages own photo likes" on public.gallery_photo_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "team reads comments" on public.gallery_comments for select to authenticated using (public.is_team_member());
create policy "member creates own comments" on public.gallery_comments for insert to authenticated with check (user_id = auth.uid());
create policy "member edits own comments" on public.gallery_comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "member deletes own comments" on public.gallery_comments for delete to authenticated using (user_id = auth.uid());
create policy "team reads comment likes" on public.gallery_comment_likes for select to authenticated using (public.is_team_member());
create policy "member manages own comment likes" on public.gallery_comment_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The current daily verse is public. Members can submit their own verse.
create policy "public reads daily verses" on public.daily_verses for select to anon, authenticated using (posted_on = current_date);
create policy "prayer director reads verses" on public.daily_verses for select to authenticated using (public.current_app_role() = 'prayer_director');
create policy "prayer director creates verses" on public.daily_verses for insert to authenticated with check (member_id = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director edits own verses" on public.daily_verses for update to authenticated using (member_id = auth.uid() and public.current_app_role() = 'prayer_director') with check (member_id = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director deletes own verses" on public.daily_verses for delete to authenticated using (member_id = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director reads own prayer points" on public.daily_prayer_points for select to authenticated using (public.current_app_role() = 'prayer_director');
create policy "prayer director creates own prayer points" on public.daily_prayer_points for insert to authenticated with check (created_by = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director edits own prayer points" on public.daily_prayer_points for update to authenticated using (created_by = auth.uid() and public.current_app_role() = 'prayer_director') with check (created_by = auth.uid() and public.current_app_role() = 'prayer_director');
create policy "prayer director deletes own prayer points" on public.daily_prayer_points for delete to authenticated using (created_by = auth.uid() and public.current_app_role() = 'prayer_director');

-- Storage buckets (create matching buckets in Dashboard, or run these statements once).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-media', 'event-media', true, 10485760, array['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('member-media', 'member-media', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('gallery-public', 'gallery-public', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "public reads event media" on storage.objects for select to anon, authenticated using (bucket_id = 'event-media');
create policy "team uploads public gallery media" on storage.objects for insert to authenticated with check (bucket_id = 'gallery-public' and public.is_team_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members update own public gallery media" on storage.objects for update to authenticated using (bucket_id = 'gallery-public' and public.is_team_member() and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'gallery-public' and public.is_team_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete own public gallery media" on storage.objects for delete to authenticated using (bucket_id = 'gallery-public' and public.is_team_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chair uploads event media" on storage.objects for insert to authenticated with check (bucket_id = 'event-media' and public.current_app_role() = 'chair');
create policy "chair updates event media" on storage.objects for update to authenticated using (bucket_id = 'event-media' and public.current_app_role() = 'chair') with check (bucket_id = 'event-media' and public.current_app_role() = 'chair');
create policy "chair deletes event media" on storage.objects for delete to authenticated using (bucket_id = 'event-media' and public.current_app_role() = 'chair');
create policy "team reads member media" on storage.objects for select to authenticated using (bucket_id = 'member-media' and public.is_team_member());
create policy "member uploads own media" on storage.objects for insert to authenticated with check (bucket_id = 'member-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member updates own media" on storage.objects for update to authenticated using (bucket_id = 'member-media' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'member-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "member deletes own media" on storage.objects for delete to authenticated using (bucket_id = 'member-media' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.gallery_photos
  add column if not exists storage_bucket text;

update public.gallery_photos
set storage_bucket = case
  when source_type = 'event' then 'event-media'
  else 'member-media'
end
where storage_bucket is null;

alter table public.gallery_photos
  alter column storage_bucket set default 'member-media',
  alter column storage_bucket set not null;

alter table public.gallery_photos
  drop constraint if exists gallery_photos_storage_bucket_check;
alter table public.gallery_photos
  add constraint gallery_photos_storage_bucket_check
  check (storage_bucket in ('event-media', 'member-media', 'gallery-public'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-public', 'gallery-public', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace view public.gallery_public with (security_invoker = false) as
  select id, image_path, storage_bucket, caption, created_at
  from public.gallery_photos
  where storage_bucket in ('event-media', 'gallery-public');

grant select on public.gallery_public to anon, authenticated;

drop policy if exists "team uploads public gallery media" on storage.objects;
create policy "team uploads public gallery media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gallery-public'
    and public.is_team_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "members update own public gallery media" on storage.objects;
create policy "members update own public gallery media" on storage.objects
  for update to authenticated
  using (bucket_id = 'gallery-public' and public.is_team_member() and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'gallery-public' and public.is_team_member() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "members delete own public gallery media" on storage.objects;
create policy "members delete own public gallery media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery-public' and public.is_team_member() and (storage.foldername(name))[1] = auth.uid()::text);

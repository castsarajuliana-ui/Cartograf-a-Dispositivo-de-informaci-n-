-- PixelNest cloud archive setup
-- Replace REPLACE_WITH_ADMIN_EMAIL with the email of the one administrator,
-- then run this script in Supabase SQL Editor.
-- Create the administrator in Authentication > Users and disable public sign-ups.
-- Never put a service_role key in the website. Use only the anon/public key.

create table if not exists public.photos (
  id text primary key,
  prompt_id integer not null,
  question text not null,
  title text not null,
  author text not null,
  category text check (category is null or category in ('Personas', 'Objetos', 'Actividades')),
  description text not null,
  date timestamptz not null,
  image_path text not null unique
);

alter table public.photos enable row level security;

drop policy if exists "Anyone can submit photos" on public.photos;
create policy "Anyone can submit photos"
  on public.photos for insert to anon, authenticated
  with check (true);

drop policy if exists "Anyone can update submitted photos" on public.photos;
drop policy if exists "Only the administrator can update photos" on public.photos;
create policy "Only the administrator can update photos"
  on public.photos for update to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('REPLACE_WITH_ADMIN_EMAIL'))
  with check (lower(auth.jwt() ->> 'email') = lower('REPLACE_WITH_ADMIN_EMAIL'));

drop policy if exists "Only the administrator can read photos" on public.photos;
create policy "Only the administrator can read photos"
  on public.photos for select to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('REPLACE_WITH_ADMIN_EMAIL'));

drop policy if exists "Only the administrator can delete photos" on public.photos;
create policy "Only the administrator can delete photos"
  on public.photos for delete to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('REPLACE_WITH_ADMIN_EMAIL'));

insert into storage.buckets (id, name, public)
values ('pixelnest-photos', 'pixelnest-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Anyone can upload PixelNest photos" on storage.objects;
create policy "Anyone can upload PixelNest photos"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'pixelnest-photos');

drop policy if exists "Only the administrator can read PixelNest photos" on storage.objects;
create policy "Only the administrator can read PixelNest photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pixelnest-photos'
    and lower(auth.jwt() ->> 'email') = lower('REPLACE_WITH_ADMIN_EMAIL')
  );

drop policy if exists "Only the administrator can delete PixelNest photos" on storage.objects;
create policy "Only the administrator can delete PixelNest photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pixelnest-photos'
    and lower(auth.jwt() ->> 'email') = lower('REPLACE_WITH_ADMIN_EMAIL')
  );

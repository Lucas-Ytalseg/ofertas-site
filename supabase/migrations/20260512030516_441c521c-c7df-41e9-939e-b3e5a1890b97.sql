
-- Helper: is_staff
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id = _user_id and role in ('admin','editor')) $$;

revoke execute on function public.is_staff(uuid) from anon;

-- Products extras
alter table public.products
  add column if not exists click_count integer not null default 0,
  add column if not exists scheduled_publish_at timestamptz;

drop policy if exists "staff manage products" on public.products;
create policy "staff manage products" on public.products
  for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "staff manage categories" on public.categories;
create policy "staff manage categories" on public.categories
  for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Click counter RPC
create or replace function public.increment_product_clicks(_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.products set click_count = click_count + 1 where id = _id and is_published = true;
$$;
revoke execute on function public.increment_product_clicks(uuid) from anon, authenticated;
grant execute on function public.increment_product_clicks(uuid) to anon, authenticated;

-- Duplicate product
create or replace function public.duplicate_product(_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'forbidden'; end if;
  insert into public.products (
    name, slug, short_description, description, price, original_price,
    image_url, gallery, affiliate_url, category_id, tags, featured,
    is_published, coupon_code, expires_at, awaiting_link, rating, review_count
  )
  select
    name || ' (cópia)', slug || '-copia-' || substr(md5(random()::text),1,5),
    short_description, description, price, original_price,
    image_url, gallery, affiliate_url, category_id, tags, false,
    false, coupon_code, expires_at, awaiting_link, rating, review_count
  from public.products where id = _id
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.duplicate_product(uuid) from anon;

-- Banners
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  subtitle text default '',
  eyebrow text default '',
  image_url text,
  image_url_mobile text,
  link_url text,
  cta_label text default 'Ver ofertas',
  align text not null default 'left' check (align in ('left','right','center')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.banners enable row level security;

drop policy if exists "banners public read" on public.banners;
create policy "banners public read" on public.banners
  for select using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "staff read all banners" on public.banners;
create policy "staff read all banners" on public.banners
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "staff manage banners" on public.banners;
create policy "staff manage banners" on public.banners
  for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop trigger if exists banners_set_updated_at on public.banners;
create trigger banners_set_updated_at before update on public.banners
  for each row execute function public.set_updated_at();

-- Site settings
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;

drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings for select using (true);

drop policy if exists "admins manage settings" on public.site_settings;
create policy "admins manage settings" on public.site_settings
  for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

insert into public.site_settings (key, value) values
  ('site', '{"name":"Direct Ofertas","tagline":"Ofertas para todos os tipos, escolhidas a dedo.","logo_url":null,"favicon_url":null}'::jsonb),
  ('social', '{"instagram":"https://www.instagram.com/direct_ofer.tas","instagram_handle":"@direct_ofer.tas","tiktok":"","facebook":"","whatsapp":""}'::jsonb),
  ('footer', '{"about":"Ofertas para todos os tipos, escolhidas a dedo.","disclaimer":"Este site contém links de afiliados. Podemos receber comissão por compras realizadas."}'::jsonb)
on conflict (key) do nothing;

-- Admin login logs
create table if not exists public.admin_login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.admin_login_logs enable row level security;

drop policy if exists "admins read login logs" on public.admin_login_logs;
create policy "admins read login logs" on public.admin_login_logs
  for select to authenticated using (has_role(auth.uid(),'admin'));

drop policy if exists "auth user inserts own log" on public.admin_login_logs;
create policy "auth user inserts own log" on public.admin_login_logs
  for insert to authenticated with check (auth.uid() = user_id);

-- Storage bucket for site assets
insert into storage.buckets (id, name, public) values ('site','site', true)
on conflict (id) do nothing;

drop policy if exists "site public read" on storage.objects;
create policy "site public read" on storage.objects
  for select using (bucket_id = 'site');

drop policy if exists "staff upload site" on storage.objects;
create policy "staff upload site" on storage.objects
  for insert to authenticated with check (bucket_id = 'site' and public.is_staff(auth.uid()));

drop policy if exists "staff update site" on storage.objects;
create policy "staff update site" on storage.objects
  for update to authenticated using (bucket_id = 'site' and public.is_staff(auth.uid()));

drop policy if exists "staff delete site" on storage.objects;
create policy "staff delete site" on storage.objects
  for delete to authenticated using (bucket_id = 'site' and public.is_staff(auth.uid()));

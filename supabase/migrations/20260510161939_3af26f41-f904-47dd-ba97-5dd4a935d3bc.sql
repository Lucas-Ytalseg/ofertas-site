
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Auto-create profile + grant admin to first user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count int;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  select count(*) into user_count from auth.users;
  if user_count = 1 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  price numeric(10,2),
  original_price numeric(10,2),
  image_url text,
  gallery text[] default '{}',
  affiliate_url text not null,
  category_id uuid references public.categories(id) on delete set null,
  tags text[] default '{}',
  rating numeric(2,1) default 0,
  review_count int default 0,
  views int not null default 0,
  featured boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create index products_category_idx on public.products(category_id);
create index products_featured_idx on public.products(featured) where featured = true;
create index products_views_idx on public.products(views desc);
create index products_tags_idx on public.products using gin(tags);

-- Favorites
create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.favorites enable row level security;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- RLS policies
create policy "profiles readable by all" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "roles readable by all" on public.user_roles for select using (true);
create policy "admins manage roles" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "categories public read" on public.categories for select using (true);
create policy "admins manage categories" on public.categories for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "products public read" on public.products for select using (is_published = true or public.has_role(auth.uid(), 'admin'));
create policy "admins manage products" on public.products for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "users read own favorites" on public.favorites for select using (auth.uid() = user_id);
create policy "users insert own favorites" on public.favorites for insert with check (auth.uid() = user_id);
create policy "users delete own favorites" on public.favorites for delete using (auth.uid() = user_id);

-- Increment views RPC (public, safe)
create or replace function public.increment_product_views(_slug text)
returns void language sql security definer set search_path = public as $$
  update public.products set views = views + 1 where slug = _slug and is_published = true;
$$;

-- Storage bucket
insert into storage.buckets (id, name, public) values ('products', 'products', true)
on conflict (id) do nothing;

create policy "product images public read" on storage.objects for select using (bucket_id = 'products');
create policy "admins upload product images" on storage.objects for insert
  with check (bucket_id = 'products' and public.has_role(auth.uid(), 'admin'));
create policy "admins update product images" on storage.objects for update
  using (bucket_id = 'products' and public.has_role(auth.uid(), 'admin'));
create policy "admins delete product images" on storage.objects for delete
  using (bucket_id = 'products' and public.has_role(auth.uid(), 'admin'));

-- Seed categories
insert into public.categories (name, slug, icon, sort_order) values
  ('Eletrônicos', 'eletronicos', 'Smartphone', 1),
  ('Roupas', 'roupas', 'Shirt', 2),
  ('Casa e Cozinha', 'casa-e-cozinha', 'Home', 3),
  ('Beleza', 'beleza', 'Sparkles', 4),
  ('Esportes', 'esportes', 'Dumbbell', 5),
  ('Outros', 'outros', 'Package', 6);

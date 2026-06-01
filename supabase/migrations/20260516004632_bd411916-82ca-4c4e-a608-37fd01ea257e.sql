ALTER TABLE public.products
  ADD CONSTRAINT affiliate_url_scheme
  CHECK (affiliate_url IS NULL OR affiliate_url ~* '^https?://');

ALTER TABLE public.banners
  ADD CONSTRAINT banner_link_url_scheme
  CHECK (link_url IS NULL OR link_url ~* '^https?://');
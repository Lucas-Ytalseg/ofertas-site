ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banner_link_url_scheme;
ALTER TABLE public.banners ADD CONSTRAINT banner_link_url_scheme
CHECK (link_url IS NULL OR link_url ~ '^(https?://|/)');
ALTER TABLE public.products
ADD CONSTRAINT products_affiliate_url_scheme_check
CHECK (
  affiliate_url IS NULL
  OR affiliate_url ~* '^https?://'
);
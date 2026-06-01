
-- Allow products without an affiliate link yet (for "awaiting link" feature)
ALTER TABLE public.products ALTER COLUMN affiliate_url DROP NOT NULL;

-- Add coupon code, expiration timestamp and awaiting-link flag
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS awaiting_link boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_awaiting_link ON public.products (awaiting_link) WHERE awaiting_link = true;
CREATE INDEX IF NOT EXISTS idx_products_expires_at ON public.products (expires_at) WHERE expires_at IS NOT NULL;

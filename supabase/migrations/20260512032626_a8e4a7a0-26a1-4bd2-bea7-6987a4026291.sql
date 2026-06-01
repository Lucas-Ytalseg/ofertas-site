
-- 1. Fix user_roles public exposure
DROP POLICY IF EXISTS "roles readable by all" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

CREATE POLICY "users read own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Lock down SECURITY DEFINER functions to least-privilege
REVOKE EXECUTE ON FUNCTION public.duplicate_product(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.duplicate_product(uuid) TO authenticated;
-- (function itself checks is_staff)

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
-- handle_new_user/set_updated_at are trigger fns; revoke direct call
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

-- increment_product_views is called via rpc from anonymous visitors — keep it
-- increment_product_clicks same
REVOKE EXECUTE ON FUNCTION public.increment_product_clicks(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_product_clicks(uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_product_views(text) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_product_views(text) TO anon, authenticated;

-- 3. Storage: prevent listing of public buckets, but keep direct file URL access
DROP POLICY IF EXISTS "Public read products" ON storage.objects;
DROP POLICY IF EXISTS "Public read site" ON storage.objects;
DROP POLICY IF EXISTS "products public read" ON storage.objects;
DROP POLICY IF EXISTS "site public read" ON storage.objects;

-- Note: public buckets serve files via the storage CDN regardless of SELECT policy.
-- Removing broad SELECT prevents anonymous LIST queries against storage.objects.
CREATE POLICY "staff list product files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id IN ('products','site') AND public.is_staff(auth.uid()));

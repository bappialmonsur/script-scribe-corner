GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.teacher_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_permissions TO authenticated;
GRANT ALL ON public.teacher_permissions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
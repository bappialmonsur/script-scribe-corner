-- Restrict pdf_notes metadata: remove public read, allow only admins and
-- students of the matching class to read note records.
DROP POLICY IF EXISTS "pdf_notes public read" ON public.pdf_notes;

CREATE POLICY "pdf_notes admin read"
ON public.pdf_notes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "pdf_notes student read own class"
ON public.pdf_notes
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.class_level = pdf_notes.class_level
      AND s.is_active = true
  )
);

-- Prevent privilege escalation: stop an admin from granting/altering the
-- admin role for their own account via the broad "admin manage roles" policy.
DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;

CREATE POLICY "admin read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin insert roles for others"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());

CREATE POLICY "admin update roles for others"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());

CREATE POLICY "admin delete roles for others"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND user_id <> auth.uid());
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS department public.department_type,
  ADD COLUMN IF NOT EXISTS batch public.batch_time;
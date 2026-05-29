-- ===== 0001 base schema =====
create type public.app_role as enum ('admin', 'student');
create type public.class_level as enum ('5', '6', '7', '8', '9', '10', '11', '12');
create type public.batch_time as enum ('morning', 'afternoon', 'evening');
create type public.department_type as enum ('science', 'business', 'none');
create type public.attendance_status as enum ('present', 'absent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles self read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles self upsert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles self read" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  father_name text,
  mother_name text,
  phone text,
  guardian_phone text,
  class_level public.class_level not null,
  batch public.batch_time not null,
  department public.department_type not null default 'none',
  roll text,
  address text,
  admission_date date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.students enable row level security;
create policy "admin read students" on public.students for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "student read own" on public.students for select to authenticated using (user_id = auth.uid());
create policy "admin insert students" on public.students for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admin update students" on public.students for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin delete students" on public.students for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_level public.class_level not null,
  date date not null,
  status public.attendance_status not null,
  reason text,
  created_at timestamptz not null default now(),
  unique(student_id, date)
);
alter table public.attendance enable row level security;
create policy "admin read attendance" on public.attendance for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "student read own attendance" on public.attendance for select to authenticated using (exists (select 1 from public.students s where s.id = attendance.student_id and s.user_id = auth.uid()));
create policy "admin write attendance" on public.attendance for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admin update attendance" on public.attendance for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin delete attendance" on public.attendance for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create index students_class_batch_idx on public.students(class_level, batch);
create index attendance_date_class_idx on public.attendance(date, class_level);

-- ===== 0002 revoke =====
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ===== 0003 bootstrap admin =====
create or replace function public.bootstrap_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare admin_count int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select count(*) into admin_count from public.user_roles where role = 'admin';
  if admin_count > 0 then return false; end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin') on conflict do nothing;
  return true;
end;
$$;
revoke execute on function public.bootstrap_first_admin() from public, anon;
grant execute on function public.bootstrap_first_admin() to authenticated;

-- ===== 0004 roll + admin helpers =====
CREATE UNIQUE INDEX IF NOT EXISTS students_phone_unique ON public.students (phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE OR REPLACE FUNCTION public.set_student_roll()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_roll int;
BEGIN
  IF NEW.roll IS NULL OR NEW.roll = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(roll, '\D', '', 'g'), '')::int), 0) + 1 INTO next_roll FROM public.students WHERE class_level = NEW.class_level;
    NEW.roll := next_roll::text;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_student_roll ON public.students;
CREATE TRIGGER trg_set_student_roll BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_student_roll();

CREATE OR REPLACE FUNCTION public.assign_admin_role(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_count int;
BEGIN
  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count > 0 AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can grant admin role'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

-- ===== 0005 cleanup legacy (no-op on fresh db) =====
DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email IS NULL OR email = '');
DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email IS NULL OR email = '');
DELETE FROM auth.users WHERE email IS NULL OR email = '';

-- ===== 0006 grants =====
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.bootstrap_first_admin() to authenticated;

-- ===== 0007 revoke =====
revoke execute on function public.bootstrap_first_admin() from authenticated;
revoke execute on function public.admin_exists() from public, anon, authenticated;
revoke execute on function public.assign_admin_role(uuid) from public, anon, authenticated;
revoke execute on function public.set_student_roll() from public, anon, authenticated;

-- ===== 0008 students.is_active =====
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_students_is_active ON public.students(is_active);

-- ===== 0009 exams + results =====
do $$ begin create type public.exam_type as enum ('daily', 'weekly', 'model_test'); exception when duplicate_object then null; end $$;
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  class_level class_level not null,
  exam_type public.exam_type not null,
  subject text not null,
  full_marks integer not null check (full_marks > 0),
  exam_date date not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_exams_class_date on public.exams (class_level, exam_date desc);
alter table public.exams enable row level security;
create policy "admin read exams" on public.exams for select to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "admin insert exams" on public.exams for insert to authenticated with check (has_role(auth.uid(), 'admin'::app_role));
create policy "admin update exams" on public.exams for update to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "admin delete exams" on public.exams for delete to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "student read own class exams" on public.exams for select to authenticated using (exists (select 1 from public.students s where s.user_id = auth.uid() and s.class_level = exams.class_level and s.is_active = true));

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);
create index if not exists idx_exam_results_exam on public.exam_results (exam_id);
create index if not exists idx_exam_results_student on public.exam_results (student_id);
alter table public.exam_results enable row level security;
create policy "admin read results" on public.exam_results for select to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "admin insert results" on public.exam_results for insert to authenticated with check (has_role(auth.uid(), 'admin'::app_role));
create policy "admin update results" on public.exam_results for update to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "admin delete results" on public.exam_results for delete to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "student read own results" on public.exam_results for select to authenticated using (exists (select 1 from public.students s where s.id = exam_results.student_id and s.user_id = auth.uid() and s.is_active = true));

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_exams_touch on public.exams;
create trigger trg_exams_touch before update on public.exams for each row execute function public.touch_updated_at();
drop trigger if exists trg_exam_results_touch on public.exam_results;
create trigger trg_exam_results_touch before update on public.exam_results for each row execute function public.touch_updated_at();

-- ===== 0010/0011 touch_updated_at hardening =====
create or replace function public.touch_updated_at() returns trigger language plpgsql security invoker set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- ===== 0012 exam pattern =====
DO $$ BEGIN CREATE TYPE public.exam_pattern AS ENUM ('written', 'mcq'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS pattern public.exam_pattern NOT NULL DEFAULT 'written';

-- ===== 0013 site content + storage =====
create table public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null, subtitle text, image_path text not null, badge text,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.hero_slides enable row level security;
create policy "hero public read" on public.hero_slides for select using (is_active = true);
create policy "hero admin all" on public.hero_slides for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create trigger hero_touch before update on public.hero_slides for each row execute function public.touch_updated_at();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text, tag text, image_path text, fee text, duration text,
  class_level class_level, sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.courses enable row level security;
create policy "courses public read" on public.courses for select using (is_active = true);
create policy "courses admin all" on public.courses for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();

create table public.pdf_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null, subject text, file_path text not null, file_size_kb int, pages int,
  class_level class_level not null, sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.pdf_notes enable row level security;
create policy "pdf_notes public read" on public.pdf_notes for select using (is_active = true);
create policy "pdf_notes admin all" on public.pdf_notes for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create trigger pdf_notes_touch before update on public.pdf_notes for each row execute function public.touch_updated_at();

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  caption text, image_path text not null, sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.gallery_images enable row level security;
create policy "gallery public read" on public.gallery_images for select using (is_active = true);
create policy "gallery admin all" on public.gallery_images for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create trigger gallery_touch before update on public.gallery_images for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public) values ('site-assets','site-assets', true), ('pdf-notes','pdf-notes', false) on conflict (id) do nothing;
create policy "site-assets public read" on storage.objects for select using (bucket_id = 'site-assets');
create policy "site-assets admin write" on storage.objects for insert to authenticated with check (bucket_id = 'site-assets' and has_role(auth.uid(),'admin'));
create policy "site-assets admin update" on storage.objects for update to authenticated using (bucket_id = 'site-assets' and has_role(auth.uid(),'admin'));
create policy "site-assets admin delete" on storage.objects for delete to authenticated using (bucket_id = 'site-assets' and has_role(auth.uid(),'admin'));
create policy "pdf-notes admin write" on storage.objects for insert to authenticated with check (bucket_id = 'pdf-notes' and has_role(auth.uid(),'admin'));
create policy "pdf-notes admin update" on storage.objects for update to authenticated using (bucket_id = 'pdf-notes' and has_role(auth.uid(),'admin'));
create policy "pdf-notes admin delete" on storage.objects for delete to authenticated using (bucket_id = 'pdf-notes' and has_role(auth.uid(),'admin'));
create policy "pdf-notes admin read" on storage.objects for select to authenticated using (bucket_id = 'pdf-notes' and has_role(auth.uid(),'admin'));

-- ===== 0014 notices =====
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, body text, class_level class_level,
  is_active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notices admin all" ON public.notices FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "notices authenticated read active" ON public.notices FOR SELECT TO authenticated USING (is_active = true);
CREATE TRIGGER notices_touch_updated_at BEFORE UPDATE ON public.notices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== 0015 mcq question bank =====
CREATE TABLE public.mcq_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_level class_level NOT NULL, subject text NOT NULL, chapter text NOT NULL,
  question text NOT NULL, options jsonb NOT NULL,
  correct_index smallint NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  explanation text, source text NOT NULL DEFAULT 'manual' CHECK (source IN ('ai','manual')),
  created_by uuid, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.validate_mcq_options()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(NEW.options) <> 'array' THEN RAISE EXCEPTION 'options must be a JSON array'; END IF;
  IF jsonb_array_length(NEW.options) <> 4 THEN RAISE EXCEPTION 'options must contain exactly 4 items'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_mcq_options BEFORE INSERT OR UPDATE ON public.mcq_questions FOR EACH ROW EXECUTE FUNCTION public.validate_mcq_options();
CREATE TRIGGER trg_touch_mcq_questions BEFORE UPDATE ON public.mcq_questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_mcq_questions_lookup ON public.mcq_questions (class_level, subject, chapter) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcq_questions TO authenticated;
GRANT ALL ON public.mcq_questions TO service_role;
ALTER TABLE public.mcq_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read active mcq" ON public.mcq_questions FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin insert mcq" ON public.mcq_questions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update mcq" ON public.mcq_questions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete mcq" ON public.mcq_questions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
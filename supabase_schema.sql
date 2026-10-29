-- =========================================================================
-- HCM Lite — Supabase Complete Database Schema & Real Data Migration
-- Run this script in your Supabase Dashboard:
-- 1. Open https://supabase.com/dashboard/project/hpmqeaxtrnrubjedgqsb
-- 2. Go to "SQL Editor" in the left sidebar
-- 3. Click "New query", paste this entire script, and click "Run" (Ctrl+Enter)
-- =========================================================================

-- 1. COMPANY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.company_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  configured BOOLEAN DEFAULT true,
  company JSONB NOT NULL DEFAULT '{}'::jsonb,
  office JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  "employeeId" TEXT,
  "mustChangePassword" BOOLEAN DEFAULT false,
  "isTempPassword" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  salary NUMERIC DEFAULT 0,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  "bankDetails" JSONB DEFAULT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  date TEXT NOT NULL,
  "checkInAt" TIMESTAMPTZ,
  "checkOutAt" TIMESTAMPTZ,
  status TEXT DEFAULT 'present',
  "totalWorkHours" NUMERIC DEFAULT 0,
  "overtimeHours" NUMERIC DEFAULT 0,
  "dutyHours" NUMERIC DEFAULT 8,
  "isLate" BOOLEAN DEFAULT false,
  "distanceMeters" NUMERIC DEFAULT 0,
  "checkOutDistanceMeters" NUMERIC DEFAULT 0,
  "isManualOverride" BOOLEAN DEFAULT false,
  remarks TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS "overtimeHours" NUMERIC DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS "dutyHours" NUMERIC DEFAULT 8;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS "isLate" BOOLEAN DEFAULT false;

-- 5. LEAVES TABLE
CREATE TABLE IF NOT EXISTS public.leaves (
  id TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "leaveType" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  days NUMERIC DEFAULT 1,
  "workingDays" NUMERIC DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  "approvedBy" TEXT DEFAULT NULL,
  "rejectionReason" TEXT DEFAULT NULL,
  "hrComment" TEXT DEFAULT '',
  "appliedBy" TEXT DEFAULT NULL,
  "appliedAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS "workingDays" NUMERIC DEFAULT 1;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS "hrComment" TEXT DEFAULT '';
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS "appliedBy" TEXT DEFAULT NULL;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- 6. PAYROLLS TABLE
CREATE TABLE IF NOT EXISTS public.payrolls (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  year INT,
  status TEXT DEFAULT 'draft',
  "finalizedAt" TIMESTAMPTZ DEFAULT NULL,
  "finalizedBy" TEXT DEFAULT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  lines JSONB DEFAULT '[]'::jsonb,
  totals JSONB DEFAULT '{}'::jsonb,
  "totalGross" NUMERIC DEFAULT 0,
  "totalNet" NUMERIC DEFAULT 0,
  "createdBy" TEXT DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.payrolls ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.payrolls ADD COLUMN IF NOT EXISTS totals JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.payrolls ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT NULL;

-- 7. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT DEFAULT 'ALL',
  priority TEXT DEFAULT 'normal',
  "createdBy" TEXT,
  "publishedAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  "announcementId" TEXT DEFAULT NULL,
  priority TEXT DEFAULT 'normal',
  "readAt" TIMESTAMPTZ DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  "actorId" TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  before JSONB DEFAULT NULL,
  after JSONB DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AI LOGS TABLE
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  "userRole" TEXT,
  query TEXT,
  "toolUsed" TEXT,
  "replyPreview" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allow read & write access for both anon and authenticated clients
-- =========================================================================

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon on company_settings" ON public.company_settings;
CREATE POLICY "Allow all for anon on company_settings" ON public.company_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on users" ON public.users;
CREATE POLICY "Allow all for anon on users" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on employees" ON public.employees;
CREATE POLICY "Allow all for anon on employees" ON public.employees FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on attendance" ON public.attendance;
CREATE POLICY "Allow all for anon on attendance" ON public.attendance FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on leaves" ON public.leaves;
CREATE POLICY "Allow all for anon on leaves" ON public.leaves FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on payrolls" ON public.payrolls;
CREATE POLICY "Allow all for anon on payrolls" ON public.payrolls FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on announcements" ON public.announcements;
CREATE POLICY "Allow all for anon on announcements" ON public.announcements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on notifications" ON public.notifications;
CREATE POLICY "Allow all for anon on notifications" ON public.notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all for anon on audit_logs" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon on ai_logs" ON public.ai_logs;
CREATE POLICY "Allow all for anon on ai_logs" ON public.ai_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- =========================================================================
-- REAL DATA SEEDING (Existing Data Migration - Zero Dummy Data!)
-- =========================================================================

-- Seed Company & Office Settings
INSERT INTO public.company_settings (id, configured, company, office, "updatedAt")
VALUES (
  'current',
  true,
  '{"id": "2b40c718-cdd1-4251-a8a4-a58508d4afbb", "name": "Saylani IT Park", "email": "hr@example.com"}'::jsonb,
  '{"startTime": "09:00", "graceMinutes": 15, "radiusMeters": 150, "latitude": 24.8607, "longitude": 67.0011}'::jsonb,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  company = EXCLUDED.company,
  office = EXCLUDED.office,
  configured = EXCLUDED.configured;

-- Seed Real Users
INSERT INTO public.users (id, name, email, "passwordHash", role, "employeeId", "mustChangePassword", "isTempPassword", "isActive", "createdAt")
VALUES
  ('0fd89f69-a6e4-4a08-94b2-0a54bb990e37', 'Mohammad Asif', 'admin@example.com', 'f84cf3f5c8c4e8468ba76db282caaee0:91cea4861f0e612bec0849396d82e2d1f204a02a0805e5cef50f97cd99f6e131b70fd20ab2904f5648648aee0cc1a8e3fa64ce4e024314d2e03ac262ea2b2914', 'ADMIN', NULL, false, false, true, '2026-10-25T14:04:24.685Z'),
  ('hr-user-0001-4444-a1b2-c3d4e5f6a7b8', 'Sarah Ahmed (HR)', 'hr@example.com', 'f84cf3f5c8c4e8468ba76db282caaee0:91cea4861f0e612bec0849396d82e2d1f204a02a0805e5cef50f97cd99f6e131b70fd20ab2904f5648648aee0cc1a8e3fa64ce4e024314d2e03ac262ea2b2914', 'HR', NULL, false, false, true, '2026-10-25T14:04:24.685Z'),
  ('ee1dbe9e-4aa0-414b-89bc-830e581edb20', 'Ali Khan', 'ali.khan@example.com', '0741df6d8c58313525da7b36dc2a709f:379c326b6f5e63b8a7670c5c78ace729088889a94838d2aebb22acca401e3f0a9ece07c662bdadfbbbe905281c18741b04545b07ea97130fd3e3e2cab763d278', 'EMPLOYEE', 'f0d7ffff-333b-4150-b0a2-6650e8734180', true, true, true, '2026-10-25T14:19:10.718Z'),
  ('98caf5c0-2ac0-400c-abb7-c04f85a140c0', 'Ibrahim Aftab', 'ibrahimfazil511@gmail.com', '445c2a2a285b0de1d4ecc3fb1b54386e:81a32fed2bf0c668f9a367b10586b91d4d852f2928c12b29549d3ab83a991aa82858a7d6d969f4675d9b80d0f61a42e70e525dbaed4187ff84fe3bb6bb37386a', 'EMPLOYEE', '6f5b7bbe-efe6-4ddc-999a-4d4dd122bb76', true, true, true, '2026-10-25T16:47:55.697Z'),
  ('fba47e05-d6ed-4bfe-9c94-7398fff7cf98', 'Shayan Aftab', 'fazilaftab13@gmail.com', '901510ef57ce4875a25b655ec168965e:570e00172fa4871e4fba5d4f15319205010848636d2e54d0bf1b1ea49008abed349d7885130158dfb1374fcb2a42d9bc93ee7f9a16b565076fa6781e79cb6081', 'EMPLOYEE', '0d3cf8a3-1746-4a71-9677-96628b28f2a6', true, true, true, '2026-10-25T20:04:35.073Z'),
  ('ec49760c-e37e-4d96-845a-b28294795b31', 'Muhammad Aftab', 'shayanaftab13@gmail.com', 'b20f8042d7104b7f11a39172d37db36a:919f74ff7cab5a939de0ffc7bb3003d150b8b01826beb8b9bb462d6f9f6a68da78748b3c56c86fd49490a60cae663c682dadbd5ecd15ef1f88e2977413cdbc2c', 'EMPLOYEE', '79e4b864-4c27-465b-81f0-9bb3115437f2', false, false, true, '2026-10-25T20:07:15.763Z')
ON CONFLICT (id) DO NOTHING;

-- Seed Real Employees
INSERT INTO public.employees (id, "userId", name, email, department, salary, phone, address, designation, "isActive", "createdAt", "updatedAt")
VALUES
  ('f0d7ffff-333b-4150-b0a2-6650e8734180', 'ee1dbe9e-4aa0-414b-89bc-830e581edb20', 'Ali Khan', 'ali.khan@example.com', 'Engineering', 150000, '', '', 'Frontend Engineer', true, '2026-10-25T14:19:10.718Z', '2026-10-25T14:19:10.718Z'),
  ('6f5b7bbe-efe6-4ddc-999a-4d4dd122bb76', '98caf5c0-2ac0-400c-abb7-c04f85a140c0', 'Ibrahim Aftab', 'ibrahimfazil511@gmail.com', 'Engineering', 10000, '03342850819', 'Karachi Pakistan', 'Hr Employee', true, '2026-10-25T16:47:55.697Z', '2026-10-25T16:47:55.697Z'),
  ('0d3cf8a3-1746-4a71-9677-96628b28f2a6', 'fba47e05-d6ed-4bfe-9c94-7398fff7cf98', 'Shayan Aftab', 'fazilaftab13@gmail.com', 'Engineering', 100000, '03222456789', 'Karachi Pakistan', 'Engineering', true, '2026-10-25T20:04:35.073Z', '2026-10-25T20:04:35.073Z'),
  ('79e4b864-4c27-465b-81f0-9bb3115437f2', 'ec49760c-e37e-4d96-845a-b28294795b31', 'Muhammad Aftab', 'shayanaftab13@gmail.com', 'Finance', 60000, '03222448580', 'Karachi Pakistan', 'Accountant', true, '2026-10-25T20:07:15.763Z', '2026-10-25T20:22:27.560Z')
ON CONFLICT (id) DO NOTHING;

-- Seed Real Attendance Record
INSERT INTO public.attendance (id, "employeeId", date, "checkInAt", "checkOutAt", status, "totalWorkHours", "distanceMeters", "checkOutDistanceMeters")
VALUES
  ('7ab86fd1-fd58-410b-b02c-7065fa4b3cf9', 'f0d7ffff-333b-4150-b0a2-6650e8734180', '2026-10-25', '2026-10-25T14:31:19.652Z', '2026-10-25T14:31:34.902Z', 'half_day', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Verify migration result
SELECT 'Migration Successful!' AS status,
  (SELECT COUNT(*) FROM public.users) AS users_count,
  (SELECT COUNT(*) FROM public.employees) AS employees_count,
  (SELECT COUNT(*) FROM public.attendance) AS attendance_count;

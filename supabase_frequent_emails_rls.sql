CREATE TABLE IF NOT EXISTS public.frequent_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.frequent_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon select"  ON public.frequent_emails;
DROP POLICY IF EXISTS "Allow anon insert"  ON public.frequent_emails;
DROP POLICY IF EXISTS "Allow anon update"  ON public.frequent_emails;
DROP POLICY IF EXISTS "Allow anon delete"  ON public.frequent_emails;
CREATE POLICY "Allow anon select" ON public.frequent_emails FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON public.frequent_emails FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON public.frequent_emails FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON public.frequent_emails FOR DELETE TO anon USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.frequent_emails;
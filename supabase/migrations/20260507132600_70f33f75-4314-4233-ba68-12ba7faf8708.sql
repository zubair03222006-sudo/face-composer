
CREATE TABLE public.forensic_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  notes TEXT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url TEXT,
  image_path TEXT,
  mode TEXT NOT NULL DEFAULT 'sketch',
  style TEXT NOT NULL DEFAULT 'grayscale',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forensic_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cases" ON public.forensic_cases FOR SELECT USING (true);
CREATE POLICY "Public insert cases" ON public.forensic_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update cases" ON public.forensic_cases FOR UPDATE USING (true);
CREATE POLICY "Public delete cases" ON public.forensic_cases FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('forensic-sketches', 'forensic-sketches', true);

CREATE POLICY "Public read sketches" ON storage.objects FOR SELECT USING (bucket_id = 'forensic-sketches');
CREATE POLICY "Public upload sketches" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'forensic-sketches');
CREATE POLICY "Public delete sketches" ON storage.objects FOR DELETE USING (bucket_id = 'forensic-sketches');

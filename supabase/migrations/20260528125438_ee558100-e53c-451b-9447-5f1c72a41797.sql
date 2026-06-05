
CREATE TABLE public.docs_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.docs_groups TO anon, authenticated;
GRANT ALL ON public.docs_groups TO service_role;

ALTER TABLE public.docs_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_groups public read"
  ON public.docs_groups FOR SELECT
  USING (is_visible = true);

-- Seed defaults from existing categories on docs_pages
INSERT INTO public.docs_groups (slug, name, sort_order)
SELECT DISTINCT lower(regexp_replace(category, '\s+', '-', 'g')), category, 0
FROM public.docs_pages
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT (slug) DO NOTHING;

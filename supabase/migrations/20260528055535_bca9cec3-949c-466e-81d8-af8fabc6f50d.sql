
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs-assets', 'docs-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read docs-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'docs-assets');

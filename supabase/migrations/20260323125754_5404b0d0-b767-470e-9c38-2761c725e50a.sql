
CREATE TABLE public.protocol_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  protocol_id text NOT NULL,
  photo_context text NOT NULL CHECK (photo_context IN ('evidence', 'meter', 'key', 'overview', 'attendance')),
  room text,
  sha256_hash text NOT NULL,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  geo_verified boolean DEFAULT false,
  distance_meters integer,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  watermark_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.protocol_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own protocol photos"
ON public.protocol_photos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE id = protocol_photos.project_id AND is_owner(user_id))
);

CREATE POLICY "Users can view own protocol photos"
ON public.protocol_photos FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = protocol_photos.project_id AND is_owner(user_id))
);

CREATE INDEX idx_protocol_photos_project ON public.protocol_photos(project_id);
CREATE INDEX idx_protocol_photos_hash ON public.protocol_photos(sha256_hash);

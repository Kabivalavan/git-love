
-- Add device-specific media URLs to banners
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS media_url_tablet text,
  ADD COLUMN IF NOT EXISTS media_url_mobile text;

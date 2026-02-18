-- Add show_timer column to offers table for timer display on product cards
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS show_timer boolean DEFAULT false;
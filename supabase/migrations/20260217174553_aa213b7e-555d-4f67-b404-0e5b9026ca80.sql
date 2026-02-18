
-- Add custom content sections to products (stored as JSONB)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS content_sections jsonb DEFAULT '[]'::jsonb;

-- content_sections will store an array of objects like:
-- [
--   { "type": "rich_text", "title": "Details", "content": "<p>...</p>", "enabled": true, "order": 1 },
--   { "type": "faq", "title": "FAQ", "items": [{"q": "...", "a": "..."}], "enabled": true, "order": 2 },
--   { "type": "size_guide", "title": "Size Guide", "content": "...", "enabled": true, "order": 3 },
--   { "type": "ingredients", "title": "Ingredients", "content": "...", "enabled": true, "order": 4 }
-- ]

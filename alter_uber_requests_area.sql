-- Run this in your Supabase SQL Editor to add the resolved area column for caching

ALTER TABLE uber_requests ADD COLUMN IF NOT EXISTS resolved_area TEXT;

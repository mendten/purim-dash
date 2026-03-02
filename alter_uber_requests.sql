-- Run this in your Supabase SQL Editor to add the missing columns

-- Add distance and estimated cost columns to uber_requests
ALTER TABLE uber_requests ADD COLUMN IF NOT EXISTS distance TEXT;
ALTER TABLE uber_requests ADD COLUMN IF NOT EXISTS estimated_cost TEXT;
ALTER TABLE uber_requests ADD COLUMN IF NOT EXISTS phone_number TEXT;

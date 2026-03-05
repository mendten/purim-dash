-- Add override columns for manual name/phone corrections
ALTER TABLE uber_requests ADD COLUMN IF NOT EXISTS override_name TEXT DEFAULT NULL;
ALTER TABLE uber_requests ADD COLUMN IF NOT EXISTS override_phone TEXT DEFAULT NULL;

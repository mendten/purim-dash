-- RUN THIS SCRIPT IN YOUR SUPABASE SQL EDITOR

-- 1. Track Uber Requests
CREATE TABLE IF NOT EXISTS uber_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id),
  pickup_address TEXT,
  dropoff_address TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','booked','completed','cancelled')),
  exact_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Track Matanos Pledges
CREATE TABLE IF NOT EXISTS matanos_pledges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id),
  amount NUMERIC(10, 2) NOT NULL,
  is_distributed BOOLEAN DEFAULT FALSE,
  is_paid_by_student BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE PURIM MODE TO PAUSE THE AI BOT GLOBALLY
INSERT INTO settings (key, value) VALUES ('purim_mode', '"true"')
ON CONFLICT (key) DO UPDATE SET value = '"true"';

-- 4. SET THE INITIAL MATANOS PIN (Can be changed here later)
INSERT INTO settings (key, value) VALUES ('matanos_pin', '"6363"')
ON CONFLICT (key) DO UPDATE SET value = '"6363"';


/*
=========================================================
INSTRUCTIONS AFTER PURIM:
Run this single line to turn the AI Bot back on:

UPDATE settings SET value = '"false"' WHERE key = 'purim_mode';
=========================================================
*/

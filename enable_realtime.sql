-- This SQL ensures Realtime is properly enabled for all three tables.
-- The messages table was already in the publication, so we only add the new ones.
-- Run each line separately if you get errors.

-- Step 1: Add Uber requests and Matanos to Realtime (safe to run):
ALTER PUBLICATION supabase_realtime ADD TABLE uber_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE matanos_pledges;

-- Step 2: Verify messages is still in realtime (this should already be true):
-- If you get an error on above lines, run this to re-add it:
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 3: Verify everything is enabled by running this SELECT:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

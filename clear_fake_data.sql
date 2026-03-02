-- This script deletes all records from uber_requests and matanos_pledges
-- It DOES NOT delete any messages or contacts, keeping the SMS history intact.

BEGIN;
  TRUNCATE TABLE uber_requests;
  TRUNCATE TABLE matanos_pledges;
COMMIT;

begin;
  -- Add the missing tables to the publication. 
  -- messages is already there, so we only add uber_requests and matanos_pledges.
  alter publication supabase_realtime add table uber_requests;
  alter publication supabase_realtime add table matanos_pledges;
commit;

-- Enable real-time for the three dashboard tables so they update without reloading!
begin;
  -- remove the tables from the publication just in case to avoid duplicates
  alter publication supabase_realtime drop table uber_requests;
  alter publication supabase_realtime drop table matanos_pledges;
  -- now add them back safely
  alter publication supabase_realtime add table uber_requests;
  alter publication supabase_realtime add table matanos_pledges;
  alter publication supabase_realtime add table messages;
commit;

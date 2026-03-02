import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ypujievpimreioakxbld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWppZXZwaW1yZWlvYWt4YmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTMwMjIsImV4cCI6MjA4MTMyOTAyMn0.I8gsutx5dT-xlPTtuCNPcFD0RVHG5quQ_1cRgicNOr4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabase() {
    console.log("Checking uber_requests...");
    const { data: ubers, error: uberErr } = await supabase.from('uber_requests').select('*');
    if (uberErr) console.error("Uber Error:", uberErr);
    else console.log("Ubers count:", ubers.length, "Latest:", ubers.slice(0, 2));

    console.log("\nChecking messages...");
    const { data: msgs, error: msgErr } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
    if (msgErr) console.error("Msg Error:", msgErr);
    else console.log("Recent Messages:", msgs);
}

checkSupabase();

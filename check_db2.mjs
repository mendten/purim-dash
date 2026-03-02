import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const s = createClient('https://ypujievpimreioakxbld.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWppZXZwaW1yZWlvYWt4YmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTMwMjIsImV4cCI6MjA4MTMyOTAyMn0.I8gsutx5dT-xlPTtuCNPcFD0RVHG5quQ_1cRgicNOr4');

async function check() {
    const { data: ubers } = await s.from('uber_requests').select('*').order('created_at', { ascending: false }).limit(2);
    const { data: msgs } = await s.from('messages').select('*').order('created_at', { ascending: false }).limit(6);
    fs.writeFileSync('output.json', JSON.stringify({ ubers, msgs }, null, 2));
    console.log("Done. Wrote to output.json");
}

check();

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ypujievpimreioakxbld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWppZXZwaW1yZWlvYWt4YmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTMwMjIsImV4cCI6MjA4MTMyOTAyMn0.I8gsutx5dT-xlPTtuCNPcFD0RVHG5quQ_1cRgicNOr4';
const s = createClient(supabaseUrl, supabaseKey);

async function exportData() {
    console.log("Fetching messages...");
    const { data: messages } = await s.from('messages').select('*').order('created_at', { ascending: false }).limit(20);

    console.log("Fetching uber_requests...");
    const { data: ubers } = await s.from('uber_requests').select('*').order('created_at', { ascending: false }).limit(20);

    console.log("Fetching matanos_pledges...");
    const { data: matanos } = await s.from('matanos_pledges').select('*').order('created_at', { ascending: false }).limit(20);

    console.log("Fetching contacts...");
    const { data: contacts } = await s.from('contacts').select('*').limit(20);

    const output = {
        messages_recent: messages,
        uber_requests: ubers,
        matanos_pledges: matanos,
        contacts_sample: contacts
    };

    fs.writeFileSync('supabase_full_dump.json', JSON.stringify(output, null, 2));
    console.log("Successfully wrote all recent data to supabase_full_dump.json");
}

exportData();

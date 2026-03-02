import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const s = createClient('https://ypujievpimreioakxbld.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWppZXZwaW1yZWlvYWt4YmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTMwMjIsImV4cCI6MjA4MTMyOTAyMn0.I8gsutx5dT-xlPTtuCNPcFD0RVHG5quQ_1cRgicNOr4');

async function check() {
    // Get the stuck queued message in detail
    const { data: queued } = await s.from('messages')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: false })
        .limit(5);

    // Get last 20 messages regardless of status
    const { data: recent } = await s.from('messages')
        .select('id, direction, phone_number, body, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    const result = {
        queued_messages: queued,
        recent_20: recent
    };

    fs.writeFileSync('sms_debug.txt', JSON.stringify(result, null, 2));
    console.log("Done");
}
check();

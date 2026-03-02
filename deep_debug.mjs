import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ypujievpimreioakxbld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWppZXZwaW1yZWlvYWt4YmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTMwMjIsImV4cCI6MjA4MTMyOTAyMn0.I8gsutx5dT-xlPTtuCNPcFD0RVHG5quQ_1cRgicNOr4';
const s = createClient(supabaseUrl, supabaseKey);

async function deepDebug() {
    const results = {};

    // 1. uber_requests
    const { data: ubers, error: uErr } = await s.from('uber_requests').select('*').limit(3);
    results['uber_requests_data'] = ubers;
    results['uber_requests_error'] = uErr;

    // 2. Try INSERT into uber_requests with anon key
    const { data: insertResult, error: insertErr } = await s.from('uber_requests').insert({
        contact_id: null,
        pickup_address: 'TEST_DEBUG_PICKUP',
        dropoff_address: 'TEST_DEBUG_DROPOFF',
        distance: null,
        cost_estimate: null,
        status: 'pending'
    }).select().single();
    results['insert_test_result'] = insertResult;
    results['insert_test_error'] = insertErr;

    // 3. purim_mode setting
    const { data: setting, error: sErr } = await s.from('settings').select('*').eq('key', 'purim_mode').single();
    results['purim_mode'] = setting;
    results['settings_error'] = sErr;

    // 4. matanos_pledges
    const { data: matanos, error: mErr } = await s.from('matanos_pledges').select('*').order('created_at', { ascending: false }).limit(3);
    results['matanos_pledges'] = matanos;
    results['matanos_error'] = mErr;

    // 5. Latest outbound messages
    const { data: msgs } = await s.from('messages').select('body, direction, created_at').eq('direction', 'outbound').order('created_at', { ascending: false }).limit(5);
    results['latest_outbound_msgs'] = msgs;

    fs.writeFileSync('debug_output.json', JSON.stringify(results, null, 2));
    console.log("Done. Wrote to debug_output.json");
}

deepDebug();

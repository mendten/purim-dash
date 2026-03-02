import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ypujievpimreioakxbld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWppZXZwaW1yZWlvYWt4YmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTMwMjIsImV4cCI6MjA4MTMyOTAyMn0.I8gsutx5dT-xlPTtuCNPcFD0RVHG5quQ_1cRgicNOr4';
const s = createClient(supabaseUrl, supabaseKey);

async function getSchema() {
    // Try inserting with EVERY possible column name to find what works
    // First just try a minimal insert
    const { data: d1, error: e1 } = await s.from('uber_requests').insert({
        pickup_address: 'TEST',
        dropoff_address: 'TEST',
        status: 'pending'
    }).select().single();

    const results = {
        minimal_insert_data: d1,
        minimal_insert_error: e1
    };

    fs.writeFileSync('schema_test.json', JSON.stringify(results, null, 2));
    console.log("Done");
}
getSchema();

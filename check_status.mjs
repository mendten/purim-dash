import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking Matanos Pledges...");
    const { data: pledges, error: matError } = await supabase.from('matanos_pledges').select('*');
    if (matError) console.error(matError);
    else {
        const pending = pledges.filter(p => !p.is_distributed);
        console.log(`Total pledges: ${pledges.length}`);
        console.log(`Pending distribution: ${pending.length}`);
        if (pending.length > 0) console.log(`First pending id: ${pending[0].id}`);
    }

    console.log("\nChecking Uber Requests...");
    const { data: ubers, error: ubError } = await supabase.from('uber_requests').select('*, contacts(name, phone_number)').order('created_at', { ascending: false }).limit(3);
    if (ubError) console.error(ubError);
    else {
        console.log(JSON.stringify(ubers, null, 2));
    }
}
check();

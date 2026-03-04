const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '');
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '');
    if (!supabaseKey && line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '');
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log("Fetching pledges...");
    const { data: pledges, error } = await supabase.from('matanos_pledges').select('*, contacts(name, phone_number)');
    if (error) throw error;

    console.log(`Found ${pledges.length} total pledges.`);

    for (const pledge of pledges) {
        if (!pledge.contact_id) {
            console.log(`Pledge ${pledge.id} missing contact... Amount: $${pledge.amount}`);
            const time = new Date(pledge.created_at);
            const timeStart = new Date(time.getTime() - 15 * 60 * 1000).toISOString();
            const timeEnd = new Date(time.getTime() + 15 * 60 * 1000).toISOString();

            const { data: messages } = await supabase.from('messages')
                .select('phone_number, contact_id, body')
                .eq('direction', 'inbound')
                .gte('created_at', timeStart)
                .lte('created_at', timeEnd);

            if (messages && messages.length > 0) {
                let foundMatch = false;
                for (const msg of messages) {
                    const text = msg.body.toUpperCase();
                    if (text.includes('$') || text.includes('DOLLAR')) {
                        const cleanText = text.replace(/[^0-9.]/g, ' ');
                        const numbers = cleanText.split(' ').filter(n => n.length > 0);
                        const amount = numbers.length > 0 ? parseFloat(numbers[0]) : 0;

                        if (amount === pledge.amount) {
                            foundMatch = true;
                            console.log(`  -> Match for $${amount} from message by ${msg.phone_number}!`);
                            let cId = msg.contact_id;
                            if (!cId) {
                                const { data: contacts } = await supabase.from('contacts').select('id').eq('phone_number', msg.phone_number).maybeSingle();
                                if (contacts) cId = contacts.id;
                            }
                            if (cId) {
                                console.log(`  -> Linking to contact ${cId}...`);
                                await supabase.from('matanos_pledges').update({ contact_id: cId }).eq('id', pledge.id);
                            } else {
                                console.log(`  -> Contact for ${msg.phone_number} still unknown.`);
                            }
                            break;
                        }
                    }
                }
                if (!foundMatch) console.log("  -> No matched message found for amount", pledge.amount);
            } else {
                console.log(`  -> No messages found in time range.`);
            }
        }
    }
    console.log("Done.");
}

fix().catch(console.error);

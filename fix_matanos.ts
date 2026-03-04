import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMatanos() {
    console.log("Fetching matanos pledges...");
    const { data: pledges, error: fetchError } = await supabase.from('matanos_pledges').select('*, contacts(name, phone_number)');
    if (fetchError) {
        console.error("Error fetching pledges:", fetchError);
        return;
    }

    console.log(`Found ${pledges.length} pledges.`);
    for (const pledge of pledges) {
        if (!pledge.contact_id) {
            console.log(`Pledge ${pledge.id} missing contact_id. Amount: $${pledge.amount}`);

            // Find message that matches this amount around this time
            const time = new Date(pledge.created_at);
            const timeStart = new Date(time.getTime() - 15 * 60 * 1000).toISOString();
            const timeEnd = new Date(time.getTime() + 15 * 60 * 1000).toISOString();

            const { data: messages } = await supabase
                .from('messages')
                .select('phone_number, contact_id, body')
                .gte('created_at', timeStart)
                .lte('created_at', timeEnd)
                .eq('direction', 'inbound');

            if (messages && messages.length > 0) {
                // Try to find the matching message
                let foundMatch = false;
                for (const msg of messages) {
                    const text = msg.body.toUpperCase();
                    if (text.includes('$') || text.includes('DOLLAR')) {
                        const cleanText = text.replace(/[^0-9.]/g, ' ');
                        const numbers = cleanText.split(' ').filter(n => n.length > 0);
                        const amount = numbers.length > 0 ? parseFloat(numbers[0]) : 0;

                        if (amount === pledge.amount) {
                            foundMatch = true;
                            console.log(`  -> Matched inbound message from ${msg.phone_number}!`);
                            let contactId = msg.contact_id;

                            if (!contactId) {
                                // Find contact by phone_number
                                const { data: contacts } = await supabase
                                    .from('contacts')
                                    .select('id')
                                    .eq('phone_number', msg.phone_number)
                                    .maybeSingle();

                                if (contacts && contacts.id) {
                                    contactId = contacts.id;
                                    console.log(`  -> Found real contact_id: ${contactId}. Updating...`);
                                    await supabase.from('matanos_pledges').update({ contact_id: contactId }).eq('id', pledge.id);
                                } else {
                                    console.log(`  -> Couldn't find a contact for ${msg.phone_number}`);
                                }
                            } else {
                                console.log(`  -> Found real contact_id from msg: ${contactId}. Updating...`);
                                await supabase.from('matanos_pledges').update({ contact_id: contactId }).eq('id', pledge.id);
                            }
                            break;
                        }
                    }
                }
                if (!foundMatch) console.log(`  -> Checked ${messages.length} messages but no amount matched $${pledge.amount}.`);
            } else {
                console.log(`  -> No matching inbound messages found around ${time}`);
            }
        }
    }
    console.log("Done.");
}

fixMatanos();

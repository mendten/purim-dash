import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '');
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '');
});

async function request(endpoint, method = 'GET', body = null) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
        method,
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        throw new Error(`Supabase API Error: ${await res.text()}`);
    }
    return res.json();
}

async function fix() {
    console.log("Fetching pledges...");
    const pledges = await request('matanos_pledges?select=id,amount,contact_id,created_at');
    console.log(`Found ${pledges.length} total pledges.`);

    for (const pledge of pledges) {
        if (!pledge.contact_id) {
            console.log(`Pledge ${pledge.id} missing contact... Amount: $${pledge.amount}`);
            const time = new Date(pledge.created_at);
            const timeStart = new Date(time.getTime() - 15 * 60 * 1000).toISOString();
            const timeEnd = new Date(time.getTime() + 15 * 60 * 1000).toISOString();

            const messages = await request(`messages?select=phone_number,contact_id,body&direction=eq.inbound&created_at=gte.${timeStart}&created_at=lte.${timeEnd}`);
            if (messages.length > 0) {
                for (const msg of messages) {
                    const text = msg.body.toUpperCase();
                    if (text.includes('$') || text.includes('DOLLAR')) {
                        const cleanText = text.replace(/[^0-9.]/g, ' ');
                        const numbers = cleanText.split(' ').filter(n => n.length > 0);
                        const amount = numbers.length > 0 ? parseFloat(numbers[0]) : 0;

                        if (amount === pledge.amount) {
                            console.log(`  -> Match for $${amount} from message by ${msg.phone_number}!`);
                            let cId = msg.contact_id;
                            if (!cId) {
                                const contacts = await request(`contacts?select=id&phone_number=eq.${encodeURIComponent(msg.phone_number)}`);
                                if (contacts.length > 0) cId = contacts[0].id;
                            }
                            if (cId) {
                                console.log(`  -> Linking to contact ${cId}...`);
                                await request(`matanos_pledges?id=eq.${pledge.id}`, 'PATCH', { contact_id: cId });
                            } else {
                                console.log(`  -> Contact for ${msg.phone_number} still unknown.`);
                            }
                            break;
                        }
                    }
                }
            } else {
                console.log(`  -> No messages found.`);
            }
        }
    }
    console.log("Done.");
}

fix().catch(console.error);

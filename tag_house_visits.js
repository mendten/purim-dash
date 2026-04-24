const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
let supabaseUrl = '', supabaseKey = '';
envFile.split('\n').forEach(l => {
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = l.split('=')[1].trim();
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = l.split('=')[1].trim();
});
const supabase = createClient(supabaseUrl, supabaseKey);

// House visit addresses — normalized to lowercase for fuzzy matching
const HOUSE_VISIT_ADDRESSES = [
    '4261 lee st',
    '6130 n central park ave',
    '3448 w peterson ave',
    '3325 w arthur',
    '6122 n monticello ave',
    '3109 w wallen',
    '6611 n drake',
    '6053 n lawndale ave',
    '2729 w coyle ave',
    '2733 w jarvis av',
    '6329 n central park ave',
    '2848 w lunt',
    '6525 n st louis ave',
    '5727 n kenneth ave',
    '3936 w loyola',
    '2709 w coyle ave',
    '2709 west coyle',
    '3126 w birchwood',
    '6631 n central park ave',
    '3500 w north shore ave',
    '3500 w northshore',
    '1632 n milwaukee',
    '5139 n clark st',
    '8630 keeler ave',
    '7439 n rockwell st',
    '7439 north rockwell',
    '6612 n richmond st',
    '6247 n monticello',
    '6521 n mozart',
    '6229 n western ave',
    '6130 central park',
    '6552 n sacramento',
    '6329 central park',
    '6525 st louis',
    '5727 kenneth',
    '3325 arthur',
];

// Normalize an address for comparison — strip extra stuff, lowercase
function normalize(addr) {
    if (!addr) return '';
    return addr
        .toLowerCase()
        .replace(/,/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Check if an address matches any house visit address
function isHouseVisit(addr) {
    const norm = normalize(addr);
    for (const hv of HOUSE_VISIT_ADDRESSES) {
        // Check if the DB address contains the key part of the house visit address
        if (norm.includes(hv)) return hv;
        // Also check if the house visit address is in the DB address
        if (hv.includes(norm.split(' ').slice(0, 3).join(' ')) && norm.length > 5) continue;
    }
    return null;
}

async function run() {
    console.log('Fetching all rides...');
    const { data: rides, error } = await supabase.from('uber_requests')
        .select('id, pickup_address, dropoff_address, corrected_pickup, corrected_dropoff, exact_price, paid_by, override_name, phone_number, contacts(name, phone_number)');

    if (error) { console.error('Error:', error); return; }
    console.log(`Found ${rides.length} rides total.\n`);

    const matches = [];
    let alreadyTagged = 0;

    for (const ride of rides) {
        // Check all address fields
        const addrsToCheck = [
            ride.dropoff_address,
            ride.corrected_dropoff,
            ride.pickup_address,
            ride.corrected_pickup
        ];

        let matchedAddr = null;
        let matchedField = '';
        for (const addr of addrsToCheck) {
            const norm = normalize(addr);
            for (const hv of HOUSE_VISIT_ADDRESSES) {
                if (norm.includes(hv)) {
                    matchedAddr = hv;
                    matchedField = addr;
                    break;
                }
            }
            if (matchedAddr) break;
        }

        if (matchedAddr) {
            const name = ride.override_name || ride.contacts?.name || 'Unknown';
            const price = ride.exact_price || 0;

            if (ride.paid_by === 'house_visits') {
                alreadyTagged++;
                continue;
            }

            matches.push({
                id: ride.id,
                name,
                price,
                matchedAddr: matchedField,
                pattern: matchedAddr
            });
        }
    }

    console.log(`Found ${matches.length} rides to tag as House Visits (${alreadyTagged} already tagged).\n`);
    console.log('='.repeat(80));

    for (const m of matches) {
        console.log(`  ${m.name.padEnd(40)} $${m.price.toFixed(2).padStart(7)}  →  ${m.matchedAddr}`);
    }

    console.log('='.repeat(80));
    console.log(`\nUpdating ${matches.length} rides to paid_by = 'house_visits'...`);

    let updated = 0;
    for (const m of matches) {
        const { error: updateErr } = await supabase
            .from('uber_requests')
            .update({ paid_by: 'house_visits' })
            .eq('id', m.id);

        if (updateErr) {
            console.error(`  ERROR updating ${m.id}:`, updateErr.message);
        } else {
            updated++;
        }
    }

    console.log(`\n✅ Done! Updated ${updated} rides to House Visits.`);
}

run().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
let supabaseUrl = '', supabaseKey = '';
envFile.split('\n').forEach(l => {
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = l.split('=')[1].trim().replace(/['"]/g, '');
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = l.split('=')[1].trim().replace(/['"]/g, '');
});
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Parse "ubers from central.txt" ───
function parseCentralFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split(/\r?\n/);
    const rides = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Skip date headers, empty lines, and action lines
        if (!line || line.startsWith('March ') || line === 'Request return' || line === 'Re-request trip' || line === 'Support' || line === 'Report lost item') {
            i++;
            continue;
        }

        // Check if this looks like a name line (not starting with $ or +, not an address with numbers at the start)
        // Heuristic: a name line is followed by a phone line starting with +1
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('+1')) {
            const name = line;
            const phone = lines[i + 1].trim().replace(/[\s-]/g, '');
            i += 2;

            // Next non-empty lines should be pickup address (1-2 lines)
            let pickup = '';
            while (i < lines.length && lines[i].trim()) {
                pickup += (pickup ? ', ' : '') + lines[i].trim();
                i++;
            }
            i++; // skip empty line

            // Next non-empty lines should be dropoff address (1-2 lines)
            let dropoff = '';
            while (i < lines.length && lines[i].trim()) {
                dropoff += (dropoff ? ', ' : '') + lines[i].trim();
                i++;
            }
            i++; // skip empty line

            // Next non-empty line should be price/status
            let price = 0;
            while (i < lines.length && !lines[i].trim()) i++;
            if (i < lines.length) {
                const priceLine = lines[i].trim();
                const priceMatch = priceLine.match(/\$([\d.]+)/);
                if (priceMatch) price = parseFloat(priceMatch[1]);
                i++;
            }

            rides.push({ name, phone, pickup, dropoff, price });
        } else {
            i++;
        }
    }
    return rides;
}

// ─── Parse "Ubers my sys.txt" ───
function parseSysFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split(/\r?\n/);
    const rides = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) { i++; continue; }

        // Check if next line is a phone number
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('+1')) {
            const name = line;
            const phone = lines[i + 1].trim().replace(/[\s-]/g, '');
            i += 2;

            // Skip empty lines
            while (i < lines.length && !lines[i].trim()) i++;

            // Time line
            i++;
            while (i < lines.length && !lines[i].trim()) i++;

            // Distance/Est line (may or may not exist)
            if (i < lines.length && (lines[i].trim().match(/mi|ft/) || lines[i].trim().startsWith('Est:'))) {
                i++;
                while (i < lines.length && !lines[i].trim()) i++;
            }
            if (i < lines.length && lines[i].trim().startsWith('Est:')) {
                i++;
                while (i < lines.length && !lines[i].trim()) i++;
            }

            // "Pickup (FROM)"
            if (i < lines.length && lines[i].trim() === 'Pickup (FROM)') {
                i++;
                while (i < lines.length && !lines[i].trim()) i++;
            }

            let pickup = '';
            if (i < lines.length) { pickup = lines[i].trim(); i++; }
            while (i < lines.length && !lines[i].trim()) i++;

            // "Dropoff (TO)"
            if (i < lines.length && lines[i].trim() === 'Dropoff (TO)') {
                i++;
                while (i < lines.length && !lines[i].trim()) i++;
            }

            let dropoff = '';
            if (i < lines.length) { dropoff = lines[i].trim(); i++; }
            while (i < lines.length && !lines[i].trim()) i++;

            // Status line (Booked, Book Uber, etc.)
            if (i < lines.length) { i++; }
            while (i < lines.length && !lines[i].trim()) i++;

            // Price line
            let price = 0;
            if (i < lines.length) {
                const priceMatch = lines[i].trim().match(/\$([\d.]+)/);
                if (priceMatch) price = parseFloat(priceMatch[1]);
                i++;
            }

            rides.push({ name, phone, pickup, dropoff, price });
        } else {
            i++;
        }
    }
    return rides;
}

// Normalize phone for comparison
function normalizePhone(p) {
    return p.replace(/[^0-9]/g, '').slice(-10);
}

async function reconcile() {
    console.log('Parsing Central file...');
    const centralRides = parseCentralFile(path.join(__dirname, 'ubers from central.txt'));
    console.log(`  Found ${centralRides.length} rides from Central.`);

    console.log('Parsing My Sys file...');
    const sysRides = parseSysFile(path.join(__dirname, 'Ubers my sys.txt'));
    console.log(`  Found ${sysRides.length} rides from My Sys.`);

    // Fetch all DB records
    console.log('Fetching DB records...');
    const { data: dbRides, error } = await supabase.from('uber_requests').select('id, contact_id, pickup_address, dropoff_address, exact_price, phone_number, override_name, override_phone, created_at, contacts(name, phone_number)');
    if (error) { console.error('DB Error:', error); return; }
    console.log(`  Found ${dbRides.length} rides in database.`);

    // Build a lookup from Central: key = normalizedPhone + '_' + price
    const centralMap = new Map();
    centralRides.forEach(r => {
        const key = normalizePhone(r.phone) + '_' + r.price.toFixed(2);
        if (!centralMap.has(key)) centralMap.set(key, []);
        centralMap.get(key).push(r);
    });

    let matchCount = 0, noMatchCount = 0;

    for (const dbRide of dbRides) {
        const dbPhone = dbRide.override_phone || dbRide.contacts?.phone_number || dbRide.phone_number || '';
        const dbPrice = dbRide.exact_price || 0;
        const key = normalizePhone(dbPhone) + '_' + dbPrice.toFixed(2);

        const centralMatches = centralMap.get(key);
        if (centralMatches && centralMatches.length > 0) {
            const central = centralMatches.shift(); // consume first match
            if (centralMatches.length === 0) centralMap.delete(key);

            const updates = {
                corrected_pickup: central.pickup,
                corrected_dropoff: central.dropoff,
                central_match: true
            };

            // Also set override_name if it's null and the DB name is "Unknown Bocher" or missing
            const currentName = dbRide.override_name || dbRide.contacts?.name || '';
            if (!currentName || currentName === 'Unknown Bocher') {
                updates.override_name = central.name;
            }

            console.log(`  ✓ MATCH: ${central.name} $${dbPrice.toFixed(2)}`);
            console.log(`    Corrected pickup: ${central.pickup}`);
            console.log(`    Corrected dropoff: ${central.dropoff}`);

            const { error: updateErr } = await supabase.from('uber_requests').update(updates).eq('id', dbRide.id);
            if (updateErr) console.error(`    ERROR updating:`, updateErr.message);
            matchCount++;
        } else {
            if (dbPrice > 0) {
                const name = dbRide.override_name || dbRide.contacts?.name || 'Unknown';
                noMatchCount++;
            }
        }
    }

    console.log(`\n========== RESULTS ==========`);
    console.log(`Matched: ${matchCount}`);
    console.log(`Unmatched (with price > 0): ${noMatchCount}`);
    console.log(`Done!`);
}

reconcile().catch(console.error);

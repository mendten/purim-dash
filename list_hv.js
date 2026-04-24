const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
let u = '', k = '';
envFile.split('\n').forEach(l => {
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) u = l.split('=')[1].trim();
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) k = l.split('=')[1].trim();
});
const s = createClient(u, k);

async function run() {
    const { data, error } = await s.from('uber_requests')
        .select('id,pickup_address,dropoff_address,corrected_pickup,corrected_dropoff,exact_price,override_name,contacts(name)')
        .eq('paid_by', 'house_visits')
        .order('exact_price', { ascending: false });

    if (error) { console.error(error); return; }

    let total = 0;
    let lines = [];
    data.forEach(r => {
        const name = r.override_name || r.contacts?.name || 'Unknown';
        const price = r.exact_price || 0;
        total += price;
        const dropoff = r.corrected_dropoff || r.dropoff_address || '';
        lines.push(`| ${name} | $${price.toFixed(2)} | ${dropoff} |`);
    });

    const output = [
        `# House Visit Rides Tagged`,
        ``,
        `**${data.length} rides** totaling **$${total.toFixed(2)}**`,
        ``,
        `| Name | Price | Dropoff Address |`,
        `|------|-------|-----------------|`,
        ...lines
    ].join('\n');

    fs.writeFileSync(path.join(process.cwd(), 'hv_report.md'), output, 'utf8');
    console.log('Report written to hv_report.md');
}

run().catch(console.error);

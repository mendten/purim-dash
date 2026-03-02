import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    console.log(`\n========================================`);
    console.log(`[PURIM ROUTER] /api/router WEBHOOK RECEIVED`);
    console.log(`[PURIM ROUTER] Time: ${new Date().toISOString()}`);
    console.log(`========================================`);

    try {
        const body = await request.json();

        // Ensure this is a Supabase Database Webhook payload
        if (body.type !== 'INSERT' || !body.record || body.record.direction !== 'inbound') {
            console.log(`[PURIM ROUTER] Ignored: Not an inbound message insert.`);
            return NextResponse.json({ status: 'ignored', reason: 'not_inbound_insert' });
        }

        const message = body.record;
        const text = message.body ? message.body.toUpperCase() : '';
        const contactId = message.contact_id;
        const phone = message.phone_number;

        console.log(`[PURIM ROUTER] Processing text from ${phone}: ${text.substring(0, 30)}...`);

        // Check Purim Mode
        const { data: setting } = await supabase.from('settings').select('value').eq('key', 'purim_mode').single();
        if (!setting || setting.value !== '"true"') {
            console.log(`[PURIM ROUTER] Ignored: Purim Mode is OFF.`);
            return NextResponse.json({ status: 'ignored', reason: 'purim_mode_off' });
        }

        // RULE 1: Matanos L'Evyonim (Contains '$' or 'DOLLAR')
        if (text.includes('$') || text.includes('DOLLAR')) {
            const cleanText = text.replace(/[^0-9.]/g, ' ');
            const numbers = cleanText.split(' ').filter((n: string) => n.length > 0);
            const amount = numbers.length > 0 ? parseFloat(numbers[0]) : 0;

            if (amount > 0) {
                console.log(`[PURIM ROUTER] Matanos match! Amount: $${amount}`);
                await supabase.from('matanos_pledges').insert({
                    contact_id: contactId,
                    amount: amount,
                    is_distributed: false,
                    is_paid_by_student: false
                });
                return NextResponse.json({ status: 'success', routedTo: 'matanos' });
            }
        }

        // RULE 2: Uber Requests
        const uberMatch = text.match(/FROM\s*:?\s*([\s\S]*?)\s*TO\s*:?\s*([\s\S]*)/i) || text.match(/FROM\s*([\s\S]*?)\s*TO\s*([\s\S]*)/i);

        if (uberMatch || text.includes('FROM ') || text.includes('TO ')) {
            let pickup = text;
            let dropoff = "See pickup note";

            if (uberMatch && uberMatch.length >= 3) {
                pickup = uberMatch[1].trim();
                dropoff = uberMatch[2].trim();
            }

            console.log(`[PURIM ROUTER] Uber match! Pickup: ${pickup}, Dropoff: ${dropoff}`);

            let distanceText = "";
            let costEstimate = "";

            const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (mapsApiKey && dropoff !== "See pickup note") {
                try {
                    const mapRes = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(dropoff)}&units=imperial&key=${mapsApiKey}`);
                    const mapData = await mapRes.json();

                    if (mapData.rows?.[0]?.elements?.[0]?.status === 'OK') {
                        const dist = mapData.rows[0].elements[0].distance.text;
                        const dur = mapData.rows[0].elements[0].duration.text;
                        const miles = parseFloat(dist.replace(/[^0-9.]/g, ''));
                        const minC = Math.round(8 + (miles * 1.2));
                        const maxC = Math.round(8 + (miles * 1.8));
                        distanceText = `${dist} (${dur})`;
                        costEstimate = `$${minC}-$${maxC}`;
                    }
                } catch (e) {
                    console.error("[PURIM ROUTER] Maps API Error:", e);
                }
            }

            const { error: insertErr } = await supabase.from('uber_requests').insert({
                contact_id: contactId,
                pickup_address: pickup,
                dropoff_address: dropoff,
                distance: distanceText || null,
                estimated_cost: costEstimate || null,
                phone_number: phone,
                status: 'new'
            });

            if (insertErr) {
                console.error("[PURIM ROUTER] Insert Error:", insertErr);
                return NextResponse.json({ status: 'error', error: insertErr.message }, { status: 500 });
            }

            let replyBody = `[Purim System] Uber request received!\nPickup: ${pickup}\nDropoff: ${dropoff}\n`;
            if (distanceText && costEstimate) {
                replyBody += `Est. Distance: ${distanceText}\nEst. Cost: ${costEstimate}\n`;
            }
            replyBody += `We will text you when it is booked!`;

            await supabase.from('messages').insert({
                contact_id: contactId,
                phone_number: phone,
                body: replyBody,
                direction: 'outbound',
                status: 'queued'
            });

            return NextResponse.json({ status: 'success', routedTo: 'ubers' });
        }

        console.log(`[PURIM ROUTER] No match, leaving in Inbox.`);
        return NextResponse.json({ status: 'success', routedTo: 'inbox' });

    } catch (e: any) {
        console.error(`[PURIM ROUTER] ❌ EXCEPTION:`, e);
        return NextResponse.json({ status: 'error', error: e.message }, { status: 500 });
    }
}

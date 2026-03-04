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
        let contactId = message.contact_id;
        const phone = message.phone_number;

        // Ensure we always have a contact_id if the contact exists
        if (!contactId && phone) {
            console.log(`[PURIM ROUTER] Contact ID missing from webhook payload, fetching manually for ${phone}...`);
            const { data: contactData } = await supabase.from('contacts').select('id').eq('phone_number', phone).maybeSingle();
            if (contactData) {
                contactId = contactData.id;
            } else {
                // Potential race condition with the messages table trigger creating the contact.
                // Wait 2000ms and try again.
                await new Promise(resolve => setTimeout(resolve, 2000));
                const { data: contactDataRetry } = await supabase.from('contacts').select('id').eq('phone_number', phone).maybeSingle();
                if (contactDataRetry) {
                    console.log(`[PURIM ROUTER] Contact found after 2s delay! ID: ${contactDataRetry.id}`);
                    contactId = contactDataRetry.id;
                } else {
                    console.log(`[PURIM ROUTER] Contact still not found after 2s delay.`);
                }
            }
        }

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

                // Send Option C confirmation text
                await supabase.from('messages').insert({
                    contact_id: contactId,
                    phone_number: phone,
                    body: `Yasher Koach! We recorded your $${amount} Matanos L'Evyonim pledge. Please keep the cash safe in your pocket until we collect it tonight. Freilichen Purim!`,
                    direction: 'outbound',
                    status: 'queued'
                });

                return NextResponse.json({ status: 'success', routedTo: 'matanos' });
            }
        }

        // RULE 2: Uber Requests
        const uberMatch = text.match(/(?:FROM|PICKUP)\s*:?\s*([\s\S]*?)\s*(?:TO|DROPOFF)\s*:?\s*([\s\S]*)/i) || text.match(/(?:FROM|PICKUP)\s*([\s\S]*?)\s*(?:TO|DROPOFF)\s*([\s\S]*)/i);

        if (uberMatch || text.includes('FROM ') || text.includes('TO ') || text.includes('PICKUP ') || text.includes('DROPOFF ')) {
            let pickup = text;
            let dropoff = "See pickup note";

            if (uberMatch && uberMatch.length >= 3) {
                pickup = uberMatch[1].trim();
                dropoff = uberMatch[2].trim();
            }

            console.log(`[PURIM ROUTER] Uber match! Pickup: ${pickup}, Dropoff: ${dropoff}`);

            let distanceText = "";
            let costEstimate = "";

            const normalizeAddress = (addr: string) => {
                const lower = addr.toLowerCase();
                if (lower.includes('chicago') || lower.includes(', il') || lower.includes('illinois') || lower.includes('ny ') || lower.includes('new york') || lower.includes('brooklyn')) {
                    return addr;
                }
                return `${addr}, Chicago, IL`;
            };

            let areaName = "Unknown Area";

            const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (mapsApiKey && dropoff !== "See pickup note") {
                try {
                    const originQuery = encodeURIComponent(normalizeAddress(pickup));
                    const destQuery = encodeURIComponent(normalizeAddress(dropoff));
                    const mapRes = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originQuery}&destinations=${destQuery}&units=imperial&key=${mapsApiKey}`);
                    const mapData = await mapRes.json();

                    if (mapData.rows?.[0]?.elements?.[0]?.status === 'OK') {
                        // Expand to full formatted addresses!
                        if (mapData.origin_addresses?.[0]) pickup = mapData.origin_addresses[0];
                        if (mapData.destination_addresses?.[0]) dropoff = mapData.destination_addresses[0];

                        const dist = mapData.rows[0].elements[0].distance.text;
                        const dur = mapData.rows[0].elements[0].duration.text;
                        const miles = parseFloat(dist.replace(/[^0-9.]/g, ''));
                        const minC = Math.round(8 + (miles * 1.2));
                        const maxC = Math.round(8 + (miles * 1.8));
                        distanceText = `${dist} (${dur})`;
                        costEstimate = `$${minC}-$${maxC}`;
                    }

                    // Look up Geocode Area for the dropoff address
                    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${destQuery}&key=${mapsApiKey}`);
                    const geoData = await geoRes.json();
                    if (geoData.status === 'OK' && geoData.results?.length > 0) {
                        const components = geoData.results[0].address_components;
                        const neighborhood = components.find((c: any) => c.types.includes('neighborhood'));
                        const sublocality = components.find((c: any) => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'));
                        const locality = components.find((c: any) => c.types.includes('locality'));

                        if (neighborhood) areaName = neighborhood.long_name;
                        else if (sublocality) areaName = sublocality.long_name;
                        else if (locality) areaName = locality.long_name;
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
                status: 'new',
                resolved_area: areaName
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

        console.log(`[PURIM ROUTER] No match, leaving in Inbox and forwarding.`);

        const RABBI_PHONE = "+14438501308";
        if (phone !== RABBI_PHONE) {
            let senderName = phone;
            // Fetch name explicitly since this webhook might not have the join
            const { data: contactData } = await supabase.from('contacts').select('name').eq('phone_number', phone).single();
            if (contactData && contactData.name) {
                senderName = contactData.name;
            }

            await supabase.from('messages').insert({
                contact_id: null,
                phone_number: RABBI_PHONE,
                body: `[FWD from ${senderName}]:\n${message.body}`,
                direction: 'outbound',
                status: 'queued'
            });
        }

        return NextResponse.json({ status: 'success', routedTo: 'inbox_and_forwarded' });

    } catch (e: any) {
        console.error(`[PURIM ROUTER] ❌ EXCEPTION:`, e);
        return NextResponse.json({ status: 'error', error: e.message }, { status: 500 });
    }
}

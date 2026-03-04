import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    console.log("[GEOCODE SYNC] Starting sync for legacy Uber requests...");
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
        }

        // Fetch requests that have a dropoff but no resolved area
        const { data: requests, error } = await supabase
            .from('uber_requests')
            .select('id, dropoff_address, resolved_area')
            .not('dropoff_address', 'eq', 'See pickup note')
            .not('dropoff_address', 'is', 'null');

        if (error) throw error;

        // Filter for requests that have no resolved_area or "Unknown Area"
        const missing = (requests || []).filter(r => !r.resolved_area || r.resolved_area === 'Unknown Area');

        console.log(`[GEOCODE SYNC] Found ${missing.length} requests needing area resolution.`);

        let updated = 0;
        const cache: Record<string, string> = {};

        for (const req of missing) {
            let areaName = "Unknown Area";

            // Use cache if we've already resolved this address in this run
            if (cache[req.dropoff_address]) {
                areaName = cache[req.dropoff_address];
            } else {
                try {
                    const destQuery = encodeURIComponent(req.dropoff_address);
                    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${destQuery}&key=${apiKey}`);
                    const geoData = await geoRes.json();

                    if (geoData.status === 'OK' && geoData.results?.length > 0) {
                        const components = geoData.results[0].address_components;
                        const neighborhood = components.find((c: any) => c.types.includes('neighborhood'));
                        const sublocality = components.find((c: any) => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'));
                        const locality = components.find((c: any) => c.types.includes('locality'));

                        if (neighborhood) areaName = neighborhood.long_name;
                        else if (sublocality) areaName = sublocality.long_name;
                        else if (locality) areaName = locality.long_name;

                        // Cache it for the next iteration
                        cache[req.dropoff_address] = areaName;
                    }
                } catch (e) {
                    console.error(`[GEOCODE SYNC] Fetch error for ${req.id}:`, e);
                }
            }

            // Update in Supabase
            if (areaName !== "Unknown Area" && req.resolved_area !== areaName) {
                await supabase.from('uber_requests').update({ resolved_area: areaName }).eq('id', req.id);
                updated++;
                console.log(`[GEOCODE SYNC] Updated ${req.id} to ${areaName}`);
            }

            // tiny delay to avoid google maps rate limiting if there are many
            await new Promise(r => setTimeout(r, 100));
        }

        return NextResponse.json({ success: true, totalFound: missing.length, updated });
    } catch (e: any) {
        console.error("[GEOCODE SYNC] Exception:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

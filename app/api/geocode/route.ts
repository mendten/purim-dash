import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
        );
        const data = await res.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const addressComponents = result.address_components;

            // Try to find neighborhood or sublocality, fallback to locality
            let areaName = "Unknown Area";

            const neighborhood = addressComponents.find((c: any) => c.types.includes('neighborhood'));
            const sublocality = addressComponents.find((c: any) => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'));
            const locality = addressComponents.find((c: any) => c.types.includes('locality'));

            if (neighborhood) {
                areaName = neighborhood.long_name;
            } else if (sublocality) {
                areaName = sublocality.long_name;
            } else if (locality) {
                areaName = locality.long_name;
            }

            return NextResponse.json({
                area: areaName,
                formatted_address: result.formatted_address,
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                original_address: address
            });
        }

        return NextResponse.json({ error: 'Could not geocode address', area: 'Unknown Area', raw: data }, { status: 422 });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        return NextResponse.json({ error: message, area: 'Unknown Area' }, { status: 500 });
    }
}

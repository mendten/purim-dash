import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');

    if (!origin || !destination) {
        return NextResponse.json({ error: 'Missing origin or destination' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`
        );
        const data = await res.json();

        if (data.rows?.[0]?.elements?.[0]?.status === 'OK') {
            const distanceText = data.rows[0].elements[0].distance.text;
            const durationText = data.rows[0].elements[0].duration.text;
            const miles = parseFloat(distanceText.replace(/[^0-9.]/g, ''));
            const minCost = 8 + (miles * 1.2);
            const maxCost = 8 + (miles * 1.8);

            return NextResponse.json({
                distance: distanceText,
                duration: durationText,
                estimatedCost: `~$${Math.round(minCost)}-$${Math.round(maxCost)}`,
                miles
            });
        }

        return NextResponse.json({ error: 'Could not calculate distance', raw: data }, { status: 422 });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

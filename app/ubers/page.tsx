"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Car, CheckCircle2, Copy, Navigation, MapPin, X, Clock, DollarSign, Phone } from "lucide-react";
import Link from "next/link";

type UberRequest = {
    id: string;
    contact_id: string;
    pickup_address: string;
    dropoff_address: string;
    status: 'new' | 'booked' | 'completed' | 'cancelled';
    exact_price: number | null;
    distance: string | null;
    estimated_cost: string | null;
    phone_number: string | null;
    created_at: string;
    contacts?: {
        name: string;
        phone_number: string;
    };
};

export default function UbersDashboard() {
    const [requests, setRequests] = useState<UberRequest[]>([]);
    const [bookingRequest, setBookingRequest] = useState<UberRequest | null>(null);
    const [exactPriceInput, setExactPriceInput] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }, []);

    const fetchRequests = async () => {
        const { data } = await supabase
            .from("uber_requests")
            .select(`*, contacts(name, phone_number)`)
            .order("created_at", { ascending: false });
        if (data) setRequests(data as UberRequest[]);
    };

    useEffect(() => {
        fetchRequests();

        const channel = supabase
            .channel("public:uber_requests")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "uber_requests" }, (payload) => {
                fetchRequests();
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("New Uber Request!", {
                        body: `Pickup: ${(payload.new as UberRequest).pickup_address}`,
                        icon: "/favicon.ico"
                    });
                }
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "uber_requests" }, fetchRequests)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const getName = (req: UberRequest): string => {
        return req.contacts?.name || 'Unknown Bocher';
    };

    const getPhone = (req: UberRequest): string => {
        return req.contacts?.phone_number || req.phone_number || '';
    };

    const handleBookSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookingRequest || !exactPriceInput) return;

        const price = parseFloat(exactPriceInput);
        if (isNaN(price)) return alert("Please enter a valid number");

        await supabase
            .from("uber_requests")
            .update({ status: "booked", exact_price: price })
            .eq("id", bookingRequest.id);

        const phone = getPhone(bookingRequest);
        if (phone) {
            await supabase
                .from("messages")
                .insert({
                    contact_id: bookingRequest.contact_id || null,
                    phone_number: phone,
                    direction: 'outbound',
                    status: 'queued',
                    body: `Your Uber has been booked! Make sure you get a confirmation text from Uber. If you don't receive it within 2 minutes, text us back ASAP so we can rebook it.`
                });
        }

        setBookingRequest(null);
        setExactPriceInput("");
        await fetchRequests();
    };

    // Stats
    const totalRides = requests.length;
    const newRides = requests.filter(r => r.status === 'new').length;
    const bookedRides = requests.filter(r => r.status === 'booked').length;
    const totalSpent = requests.reduce((acc, r) => acc + (r.exact_price || 0), 0);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex bg-white p-6 rounded-2xl shadow-sm border border-slate-100 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#1a237e]/10 text-[#1a237e] rounded-xl flex items-center justify-center">
                            <Car size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#1a237e]">Uber Requests</h1>
                            <p className="text-slate-500 text-sm">Live Dispatch Dashboard</p>
                        </div>
                    </div>
                    <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-700">← Back Hub</Link>
                </div>

                {/* Totals Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase">Total</p>
                        <p className="text-2xl font-black text-slate-800">{totalRides}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-[#fbc02d] text-center">
                        <p className="text-xs font-bold text-[#fbc02d] uppercase">New</p>
                        <p className="text-2xl font-black text-[#fbc02d]">{newRides}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-green-200 text-center">
                        <p className="text-xs font-bold text-green-600 uppercase">Booked</p>
                        <p className="text-2xl font-black text-green-600">{bookedRides}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Spent</p>
                        <p className="text-2xl font-black text-[#1a237e]">${totalSpent.toFixed(2)}</p>
                    </div>
                </div>

                {/* Requests Feed */}
                <div className="grid gap-6">
                    {requests.map(req => (
                        <div key={req.id} className={`bg-white rounded-2xl shadow-sm border transition-all ${req.status === 'new' ? 'border-[#fbc02d]' : 'border-slate-100 opacity-80'}`}>
                            <div className="p-6 grid md:grid-cols-4 gap-6 items-center">

                                {/* Bocher Info */}
                                <div className="md:col-span-1 border-r border-slate-100 pr-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">{getName(req)}</h3>
                                            {/* Phone number with copy */}
                                            <div className="flex items-center gap-2 mt-1 group cursor-pointer" onClick={() => handleCopy(getPhone(req), req.id + 'phone')}>
                                                <Phone size={14} className="text-slate-400" />
                                                <p className="font-mono text-sm text-slate-500">{getPhone(req) || 'No number'}</p>
                                                {copiedId === req.id + 'phone'
                                                    ? <CheckCircle2 size={14} className="text-green-500" />
                                                    : <Copy size={14} className="text-slate-300 group-hover:text-slate-400" />}
                                            </div>
                                        </div>
                                        {req.status === 'new' && (
                                            <span className="flex h-3 w-3 relative">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fbc02d] opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#fbc02d]"></span>
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-4">{new Date(req.created_at).toLocaleTimeString()}</p>
                                    {/* Distance & Cost Estimate */}
                                    {(req.distance || req.estimated_cost) && (
                                        <div className="mt-3 space-y-1">
                                            {req.distance && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Clock size={12} />
                                                    <span>{req.distance}</span>
                                                </div>
                                            )}
                                            {req.estimated_cost && (
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1a237e]">
                                                    <DollarSign size={12} />
                                                    <span>Est: {req.estimated_cost}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Addresses */}
                                <div className="md:col-span-2 space-y-3">
                                    <div className="group cursor-pointer flex gap-4 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                                        onClick={() => handleCopy(req.pickup_address, req.id + 'pickup')}>
                                        <div className="mt-1 text-slate-400 group-hover:text-[#1a237e]"><Navigation size={18} /></div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pickup (FROM)</p>
                                            <p className="text-slate-700 font-medium">{req.pickup_address}</p>
                                        </div>
                                        <div>
                                            {copiedId === req.id + 'pickup' ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} className="text-slate-300 group-hover:text-slate-400" />}
                                        </div>
                                    </div>

                                    <div className="group cursor-pointer flex gap-4 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                                        onClick={() => handleCopy(req.dropoff_address, req.id + 'dropoff')}>
                                        <div className="mt-1 text-slate-400 group-hover:text-[#fbc02d]"><MapPin size={18} /></div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dropoff (TO)</p>
                                            <p className="text-slate-700 font-medium">{req.dropoff_address}</p>
                                        </div>
                                        <div>
                                            {copiedId === req.id + 'dropoff' ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} className="text-slate-300 group-hover:text-slate-400" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="md:col-span-1 flex flex-col items-center justify-center">
                                    {req.status === 'new' ? (
                                        <button
                                            onClick={() => setBookingRequest(req)}
                                            className="w-full bg-[#1a237e] text-white font-bold py-4 rounded-xl hover:bg-[#1a237e]/90 transition-all shadow-md shadow-[#1a237e]/20"
                                        >
                                            Book Uber
                                        </button>
                                    ) : (
                                        <div className="text-center">
                                            <div className="inline-flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl mb-2 border border-green-100">
                                                <CheckCircle2 size={20} />
                                                <span className="font-bold">Booked</span>
                                            </div>
                                            <p className="text-xl font-black text-slate-700">${req.exact_price?.toFixed(2)}</p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    ))}
                    {requests.length === 0 && (
                        <div className="p-12 text-center text-slate-400 bg-white border border-slate-100 rounded-2xl">No Uber requests right now. Relax!</div>
                    )}
                </div>

                {/* Booking Modal */}
                {bookingRequest && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl relative">
                            <button onClick={() => setBookingRequest(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700">
                                <X size={24} />
                            </button>

                            <div className="w-16 h-16 bg-[#fbc02d]/20 text-[#fbc02d] rounded-full flex items-center justify-center mb-6 text-2xl font-black">
                                $
                            </div>
                            <h2 className="text-2xl font-bold text-[#1a237e] mb-2">Confirm Booking</h2>
                            <p className="text-slate-500 mb-2">Enter the exact price from Uber for <strong>{getName(bookingRequest)}</strong>&apos;s ride.</p>
                            {bookingRequest.estimated_cost && (
                                <p className="text-sm text-[#1a237e] font-bold bg-[#1a237e]/5 px-3 py-2 rounded-lg mb-4">
                                    Maps Estimate: {bookingRequest.estimated_cost} ({bookingRequest.distance})
                                </p>
                            )}

                            <form onSubmit={handleBookSubmit}>
                                <div className="relative mb-6">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-slate-400 font-medium">$</span>
                                    <input
                                        type="number" step="0.01" min="0" required
                                        value={exactPriceInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExactPriceInput(e.target.value)}
                                        className="w-full text-4xl font-black text-slate-800 pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-200 focus:border-[#fbc02d] focus:outline-none transition-colors"
                                        placeholder="0.00" autoFocus
                                    />
                                </div>
                                <button type="submit" className="w-full bg-[#1a237e] text-white font-bold py-4 rounded-xl hover:bg-[#1a237e]/90 transition-colors text-lg">
                                    Confirm &amp; SMS Bocher
                                </button>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

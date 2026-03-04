"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Car, MapPin, Users, Download, Printer, ArrowLeft, BarChart3 } from "lucide-react";
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
    // Appended via Geocode API during fetch
    resolved_area?: string;
};

type GroupedByLocation = {
    area: string;
    rides: UberRequest[];
    totalCost: number;
};

type GroupedByPerson = {
    name: string;
    phone: string;
    rides: UberRequest[];
    totalCost: number;
};

export default function UberReports() {
    const [requests, setRequests] = useState<UberRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'location' | 'person' | 'summary'>('location');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from("uber_requests")
                .select(`*, contacts(name, phone_number)`)
                .order("created_at", { ascending: false });

            if (data) {
                // The area is now resolved in the backend routing and saved to the DB
                // but for older rides before the update, we'll keep a fallback string
                const enrichedRequests = data.map((req: any) => ({
                    ...req,
                    resolved_area: req.resolved_area || (req.dropoff_address && req.dropoff_address !== "See pickup note" ? "Unknown Area" : "N/A (No Dropoff)")
                })) as UberRequest[];

                setRequests(enrichedRequests);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const getName = (req: UberRequest): string => {
        return req.contacts?.name || 'Unknown Bocher';
    };

    const getPhone = (req: UberRequest): string => {
        return req.contacts?.phone_number || req.phone_number || '';
    };

    // Calculate groupings
    const groupedByLocation: GroupedByLocation[] = [];
    const groupedByPerson: GroupedByPerson[] = [];

    // Grouping logic...
    const locationMap = new Map<string, GroupedByLocation>();
    const personMap = new Map<string, GroupedByPerson>();

    requests.forEach(req => {
        // Only include requests with a price for reporting purposes, or all of them if you want
        // For payout/export, booked/completed requests with exact_price are key

        // Location
        const area = req.resolved_area || "Unknown Area";
        if (!locationMap.has(area)) {
            locationMap.set(area, { area, rides: [], totalCost: 0 });
        }
        const locGroup = locationMap.get(area)!;
        locGroup.rides.push(req);
        locGroup.totalCost += (req.exact_price || 0);

        // Person
        const personKey = `${getName(req)}|${getPhone(req)}`;
        if (!personMap.has(personKey)) {
            personMap.set(personKey, { name: getName(req), phone: getPhone(req), rides: [], totalCost: 0 });
        }
        const perGroup = personMap.get(personKey)!;
        perGroup.rides.push(req);
        perGroup.totalCost += (req.exact_price || 0);
    });

    // Convert maps to sorted arrays
    groupedByLocation.push(...Array.from(locationMap.values()).sort((a, b) => b.totalCost - a.totalCost));
    groupedByPerson.push(...Array.from(personMap.values()).sort((a, b) => b.totalCost - a.totalCost));

    // Stats
    const totalRides = requests.length;
    const paidRides = requests.filter(r => r.exact_price !== null).length;
    const totalCost = requests.reduce((acc, r) => acc + (r.exact_price || 0), 0);
    const avgCost = paidRides > 0 ? (totalCost / paidRides).toFixed(2) : "0.00";

    const exportToCSV = () => {
        const headers = ["Name", "Phone", "Pickup", "Dropoff", "Resolved Area", "Status", "Exact Price", "Date"];
        const rows = requests.map(req => [
            `"${getName(req)}"`,
            `"${getPhone(req)}"`,
            `"${req.pickup_address}"`,
            `"${req.dropoff_address}"`,
            `"${req.resolved_area || ''}"`,
            req.status,
            req.exact_price || 0,
            `"${new Date(req.created_at).toLocaleString()}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "purim_uber_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] print:bg-white p-4 md:p-8">
            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-break-inside-avoid { break-inside: avoid; }
                    body { background: white; }
                }
            `}</style>

            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex bg-white p-6 rounded-2xl shadow-sm border border-slate-100 items-center justify-between print:border-none print:shadow-none print:p-0 print:mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#1a237e]/10 text-[#1a237e] rounded-xl flex flex-col items-center justify-center pt-1 no-print">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#1a237e]">Uber Reports</h1>
                            <p className="text-slate-500 text-sm">Post-Purim Settlement & Export</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 no-print">
                        <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                            <Download size={18} />
                            <span className="hidden md:inline">Export CSV</span>
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                            <Printer size={18} />
                            <span className="hidden md:inline">Print</span>
                        </button>
                        <Link href="/ubers" className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-700 ml-2 border border-slate-200 rounded-xl flex items-center gap-2">
                            <ArrowLeft size={16} /> Dashboard
                        </Link>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center p-12 text-slate-500 font-medium animate-pulse">
                        Loading requests and resolving locations...
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex bg-white p-2 rounded-xl shadow-sm border border-slate-100 no-print">
                            <button
                                onClick={() => setActiveTab('location')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${activeTab === 'location' ? 'bg-[#1a237e] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <MapPin size={18} /> By Location
                            </button>
                            <button
                                onClick={() => setActiveTab('person')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${activeTab === 'person' ? 'bg-[#1a237e] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <Users size={18} /> By Person
                            </button>
                            <button
                                onClick={() => setActiveTab('summary')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${activeTab === 'summary' ? 'bg-[#1a237e] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <BarChart3 size={18} /> Summary Stats
                            </button>
                        </div>

                        {/* Content: By Location */}
                        {(activeTab === 'location' || (typeof window !== 'undefined' && window.matchMedia('print').matches)) && (
                            <div className={`space-y-6 ${activeTab !== 'location' ? 'hidden print:block' : 'block'}`}>
                                <h2 className="hidden print:block text-2xl font-bold text-[#1a237e] mb-4 border-b pb-2">By Location</h2>
                                {groupedByLocation.map((group, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:border-slate-300 print:shadow-none print-break-inside-avoid">
                                        <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center print:bg-slate-100">
                                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                <MapPin className="text-[#1a237e]" size={20} />
                                                {group.area}
                                            </h3>
                                            <div className="text-lg font-black text-[#1a237e] bg-[#1a237e]/10 px-4 py-1.5 rounded-lg print:border print:border-[#1a237e]">
                                                ${group.totalCost.toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="p-0">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-[#f8fafc] text-xs uppercase text-slate-500 font-bold print:bg-white">
                                                    <tr>
                                                        <th className="p-4 py-3 border-b">Bocher</th>
                                                        <th className="p-4 py-3 border-b hidden md:table-cell">Pickup &rarr; Dropoff</th>
                                                        <th className="p-4 py-3 border-b text-right">Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.rides.map(req => (
                                                        <tr key={req.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 tr-transition">
                                                            <td className="p-4">
                                                                <div className="font-bold text-slate-800">{getName(req)}</div>
                                                                <div className="text-xs text-slate-400">{getPhone(req)}</div>
                                                            </td>
                                                            <td className="p-4 hidden md:table-cell text-slate-600">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="text-xs"><span className="font-bold text-slate-400">FR:</span> {req.pickup_address}</div>
                                                                    <div className="text-xs"><span className="font-bold text-slate-400">TO:</span> {req.dropoff_address}</div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-right font-bold text-green-700">
                                                                ${(req.exact_price || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Content: By Person */}
                        {activeTab === 'person' && (
                            <div className="space-y-6">
                                {groupedByPerson.map((group, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg">
                                                    {group.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800">{group.name}</h3>
                                                    <p className="text-xs text-slate-500 font-mono">{group.phone}</p>
                                                </div>
                                            </div>
                                            <div className="text-lg font-black text-[#1a237e] bg-[#1a237e]/10 px-4 py-1.5 rounded-lg">
                                                ${group.totalCost.toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="p-0">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-[#f8fafc] text-xs uppercase text-slate-500 font-bold">
                                                    <tr>
                                                        <th className="p-4 py-3 border-b w-1/4">Date</th>
                                                        <th className="p-4 py-3 border-b">Area</th>
                                                        <th className="p-4 py-3 border-b text-right">Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.rides.map(req => (
                                                        <tr key={req.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                                            <td className="p-4 text-slate-500 text-xs">
                                                                {new Date(req.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="font-semibold text-slate-700">{req.resolved_area || 'Unknown'}</div>
                                                                <div className="text-xs text-slate-400 truncate max-w-[200px] md:max-w-md">{req.dropoff_address}</div>
                                                            </td>
                                                            <td className="p-4 text-right font-bold text-green-700">
                                                                ${(req.exact_price || 0).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Content: Summary */}
                        {activeTab === 'summary' && (
                            <div className="space-y-6">
                                {/* Totals Bar */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center shadow-sm">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Total Rides</p>
                                        <p className="text-4xl font-black text-slate-800 mt-2">{totalRides}</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center shadow-sm">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Paid Rides</p>
                                        <p className="text-4xl font-black text-green-600 mt-2">{paidRides}</p>
                                    </div>
                                    <div className="bg-[#1a237e] p-6 rounded-2xl border border-[#1a237e] text-center shadow-md relative overflow-hidden">
                                        <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10">
                                            <Car size={100} />
                                        </div>
                                        <p className="text-sm font-bold text-indigo-200 uppercase tracking-wide relative z-10">Total Spent</p>
                                        <p className="text-4xl font-black text-white mt-2 relative z-10">${totalCost.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center shadow-sm">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Avg Cost</p>
                                        <p className="text-4xl font-black text-slate-800 mt-2">${avgCost}</p>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm text-center">
                                    <div className="inline-flex w-20 h-20 bg-green-50 text-green-500 rounded-full items-center justify-center mb-4">
                                        <Printer size={32} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Ready for Reimbursement</h2>
                                    <p className="text-slate-500 max-w-lg mx-auto mb-6">
                                        Use the buttons at the top of the page to export all raw data to Excel (CSV) or print a clean copy of the categorized tables for reimbursement accounting.
                                    </p>
                                    <button onClick={handlePrint} className="bg-[#1a237e] text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-800 transition-colors shadow-md">
                                        Print Location Report
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
}


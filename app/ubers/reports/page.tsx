"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Car, MapPin, Users, Download, Printer, ArrowLeft, BarChart3, Edit, Trash2, PlusCircle, X, Save, Search } from "lucide-react";
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
    override_name?: string | null;
    override_phone?: string | null;
    paid_by?: string | null;
    corrected_pickup?: string | null;
    corrected_dropoff?: string | null;
    central_match?: boolean | null;
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

const PAID_BY_OPTIONS = [
    { value: 'grant', label: 'Grant', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'shliach', label: 'Shliach', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'house_visits', label: 'House Visits', color: 'bg-green-100 text-green-700 border-green-200' },
];

export default function UberReports() {
    const [requests, setRequests] = useState<UberRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<'location' | 'person' | 'summary'>('location');
    const [expandedLocs, setExpandedLocs] = useState<Record<string, boolean>>({});
    const [expandedPersons, setExpandedPersons] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');

    // Editing State
    const [editingRequest, setEditingRequest] = useState<UberRequest | null>(null);
    const [editForm, setEditForm] = useState<{ name: string, phone: string, price: string, area: string, pickup: string, dropoff: string }>({ name: '', phone: '', price: '', area: '', pickup: '', dropoff: '' });
    const [isSaving, setIsSaving] = useState(false);

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

    const runSync = async () => {
        if (!confirm("This will scan all old rides and assign them to a location area. Continue?")) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/geocode-sync', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                alert(`Successfully synced ${result.updated} records! Re-fetching data...`);
                await fetchData();
            } else {
                alert(`Error syncing: ${result.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error running sync.");
        } finally {
            setIsSyncing(false);
        }
    };

    const getName = (req: UberRequest): string => {
        return req.override_name || req.contacts?.name || 'Unknown Bocher';
    };

    const getPhone = (req: UberRequest): string => {
        return req.override_phone || req.contacts?.phone_number || req.phone_number || '';
    };

    const getPickup = (req: UberRequest): string => {
        return req.corrected_pickup || req.pickup_address || '';
    };

    const getDropoff = (req: UberRequest): string => {
        return req.corrected_dropoff || req.dropoff_address || '';
    };

    const openEditModal = (req: UberRequest, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingRequest(req);
        setEditForm({
            name: getName(req),
            phone: getPhone(req),
            price: req.exact_price !== null ? req.exact_price.toString() : '',
            area: req.resolved_area || '',
            pickup: getPickup(req),
            dropoff: getDropoff(req)
        });
    };

    const closeEditModal = () => {
        setEditingRequest(null);
    };

    const saveEdit = async () => {
        if (!editingRequest) return;
        setIsSaving(true);
        try {
            const priceVal = editForm.price ? parseFloat(editForm.price) : null;
            const updates: Record<string, any> = {
                exact_price: priceVal,
                resolved_area: editForm.area,
                pickup_address: editForm.pickup,
                dropoff_address: editForm.dropoff,
                override_name: editForm.name || null,
                override_phone: editForm.phone || null
            };

            const { error } = await supabase.from('uber_requests').update(updates).eq('id', editingRequest.id);
            if (error) throw error;

            setRequests(requests.map(r => r.id === editingRequest.id ? { ...r, ...updates } : r));
            closeEditModal();
        } catch (e) {
            console.error(e);
            alert("Error saving request.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePaidByChange = async (id: string, value: string) => {
        // Optimistic update
        setRequests(prev => prev.map(r => r.id === id ? { ...r, paid_by: value } : r));

        const { error } = await supabase.from('uber_requests').update({ paid_by: value }).eq('id', id);
        if (error) {
            console.error(error);
            alert("Error updating paid by.");
            await fetchData(); // revert
        }
    };

    const deleteRequest = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this ride completely? This cannot be undone.")) return;

        try {
            const { error } = await supabase.from('uber_requests').delete().eq('id', id);
            if (error) throw error;

            setRequests(requests.filter(r => r.id !== id));
        } catch (e) {
            console.error(e);
            alert("Error deleting request.");
        }
    };

    const addManualBreakdown = async () => {
        const name = prompt("Enter Bocher Name:");
        if (!name) return;
        const phone = prompt("Enter Phone Number (optional):") || "";
        const priceStr = prompt("Enter Price (e.g., 15.50):");
        if (!priceStr) return;
        const price = parseFloat(priceStr);
        if (isNaN(price)) return alert("Invalid price.");
        const area = prompt("Enter Resolved Area (e.g., West Ridge):") || "Unknown Area";

        try {
            const { data, error } = await supabase.from('uber_requests').insert({
                pickup_address: "Manual Entry",
                dropoff_address: "Manual Entry",
                status: "completed",
                exact_price: price,
                phone_number: phone,
                resolved_area: area,
                contact_id: null,
                paid_by: 'grant'
            }).select();

            if (error) throw error;

            if (data && data.length > 0) {
                const newReq = { ...data[0], contacts: { name, phone_number: phone } } as UberRequest;
                setRequests([newReq, ...requests]);
            }
        } catch (e) {
            console.error(e);
            alert("Error adding request.");
        }
    };

    // Search filter
    const filteredRequests = searchQuery.trim()
        ? requests.filter(req => {
            const q = searchQuery.toLowerCase();
            return (
                getName(req).toLowerCase().includes(q) ||
                getPhone(req).includes(q) ||
                getPickup(req).toLowerCase().includes(q) ||
                getDropoff(req).toLowerCase().includes(q) ||
                (req.pickup_address || '').toLowerCase().includes(q) ||
                (req.dropoff_address || '').toLowerCase().includes(q) ||
                (req.resolved_area || '').toLowerCase().includes(q)
            );
        })
        : requests;

    // Calculate groupings
    const locationMap = new Map<string, GroupedByLocation>();
    const personMap = new Map<string, GroupedByPerson>();

    filteredRequests.forEach(req => {
        const area = req.resolved_area || "Unknown Area";
        if (!locationMap.has(area)) {
            locationMap.set(area, { area, rides: [], totalCost: 0 });
        }
        const locGroup = locationMap.get(area)!;
        locGroup.rides.push(req);
        locGroup.totalCost += (req.exact_price || 0);

        const personKey = `${getName(req)}|${getPhone(req)}`;
        if (!personMap.has(personKey)) {
            personMap.set(personKey, { name: getName(req), phone: getPhone(req), rides: [], totalCost: 0 });
        }
        const perGroup = personMap.get(personKey)!;
        perGroup.rides.push(req);
        perGroup.totalCost += (req.exact_price || 0);
    });

    const groupedByLocation = Array.from(locationMap.values()).sort((a, b) => b.totalCost - a.totalCost);
    const groupedByPerson = Array.from(personMap.values()).sort((a, b) => b.totalCost - a.totalCost);

    // Stats
    const totalRides = filteredRequests.length;
    const paidRides = filteredRequests.filter(r => r.exact_price !== null).length;
    const totalCost = filteredRequests.reduce((acc, r) => acc + (r.exact_price || 0), 0);
    const avgCost = paidRides > 0 ? (totalCost / paidRides).toFixed(2) : "0.00";

    // Paid By totals
    const grantTotal = filteredRequests.filter(r => (r.paid_by || 'grant') === 'grant').reduce((acc, r) => acc + (r.exact_price || 0), 0);
    const shliachTotal = filteredRequests.filter(r => r.paid_by === 'shliach').reduce((acc, r) => acc + (r.exact_price || 0), 0);
    const houseVisitsTotal = filteredRequests.filter(r => r.paid_by === 'house_visits').reduce((acc, r) => acc + (r.exact_price || 0), 0);

    const exportToCSV = () => {
        const headers = ["Name", "Phone", "Pickup", "Dropoff", "Corrected Pickup", "Corrected Dropoff", "Resolved Area", "Status", "Exact Price", "Paid By", "Date"];
        const rows = filteredRequests.map(req => [
            `"${getName(req)}"`,
            `"${getPhone(req)}"`,
            `"${req.pickup_address}"`,
            `"${req.dropoff_address}"`,
            `"${req.corrected_pickup || ''}"`,
            `"${req.corrected_dropoff || ''}"`,
            `"${req.resolved_area || ''}"`,
            req.status,
            req.exact_price || 0,
            `"${req.paid_by || 'grant'}"`,
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

    // Shared ride row component
    const renderPaidByDropdown = (req: UberRequest) => {
        const current = req.paid_by || 'grant';
        const opt = PAID_BY_OPTIONS.find(o => o.value === current) || PAID_BY_OPTIONS[0];
        return (
            <select
                value={current}
                onChange={(e) => handlePaidByChange(req.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-bold rounded-lg px-2 py-1 border cursor-pointer outline-none transition-all ${opt.color}`}
            >
                {PAID_BY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        );
    };

    const renderAddressCell = (req: UberRequest) => {
        const hasCorrections = req.corrected_pickup || req.corrected_dropoff;
        const pickup = getPickup(req);
        const dropoff = getDropoff(req);
        return (
            <div className="flex flex-col gap-1">
                <div className="text-xs">
                    <span className="font-bold text-slate-400">FR:</span> {pickup}
                    {hasCorrections && req.corrected_pickup && req.pickup_address !== req.corrected_pickup && (
                        <span className="text-[10px] text-slate-300 ml-1">(orig: {req.pickup_address})</span>
                    )}
                </div>
                <div className="text-xs">
                    <span className="font-bold text-slate-400">TO:</span> {dropoff}
                    {hasCorrections && req.corrected_dropoff && req.dropoff_address !== req.corrected_dropoff && (
                        <span className="text-[10px] text-slate-300 ml-1">(orig: {req.dropoff_address})</span>
                    )}
                </div>
            </div>
        );
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

                    <div className="flex items-center gap-3 no-print flex-wrap justify-end">
                        <button
                            onClick={runSync}
                            disabled={isSyncing}
                            className={`flex items-center gap-2 px-4 py-2 ${isSyncing ? 'bg-indigo-100 text-indigo-400' : 'bg-indigo-50 hover:bg-indigo-100 text-[#1a237e]'} font-bold rounded-xl transition-colors`}
                        >
                            <MapPin size={18} />
                            <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Resolve Missing Areas'}</span>
                        </button>
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
                        {/* Paid By Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Spent</p>
                                <p className="text-2xl font-black text-slate-800">${totalCost.toFixed(2)}</p>
                                <p className="text-[10px] text-slate-400">{totalRides} rides</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center shadow-sm">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Grant</p>
                                <p className="text-2xl font-black text-blue-700">${grantTotal.toFixed(2)}</p>
                                <p className="text-[10px] text-blue-400">{filteredRequests.filter(r => (r.paid_by || 'grant') === 'grant').length} rides</p>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center shadow-sm">
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Shliach</p>
                                <p className="text-2xl font-black text-amber-700">${shliachTotal.toFixed(2)}</p>
                                <p className="text-[10px] text-amber-400">{filteredRequests.filter(r => r.paid_by === 'shliach').length} rides</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center shadow-sm">
                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">House Visits</p>
                                <p className="text-2xl font-black text-green-700">${houseVisitsTotal.toFixed(2)}</p>
                                <p className="text-[10px] text-green-400">{filteredRequests.filter(r => r.paid_by === 'house_visits').length} rides</p>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative no-print">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, address, area..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-[#1a237e]/20 focus:border-[#1a237e] outline-none transition-all shadow-sm"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

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
                                        <div
                                            className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center print:bg-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => setExpandedLocs(prev => ({ ...prev, [group.area]: !prev[group.area] }))}
                                        >
                                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                <MapPin className="text-[#1a237e]" size={20} />
                                                {group.area}
                                                <span className="text-sm font-medium text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full ml-2">
                                                    {group.rides.length} rides
                                                </span>
                                            </h3>
                                            <div className="text-lg font-black text-[#1a237e] bg-[#1a237e]/10 px-4 py-1.5 rounded-lg print:border print:border-[#1a237e]">
                                                ${group.totalCost.toFixed(2)}
                                            </div>
                                        </div>
                                        {(expandedLocs[group.area] || (typeof window !== 'undefined' && window.matchMedia('print').matches)) && (
                                            <div className="p-0 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-[#f8fafc] text-xs uppercase text-slate-500 font-bold print:bg-white">
                                                        <tr>
                                                            <th className="p-4 py-3 border-b">Bocher</th>
                                                            <th className="p-4 py-3 border-b hidden md:table-cell">Pickup &rarr; Dropoff</th>
                                                            <th className="p-4 py-3 border-b text-right">Price</th>
                                                            <th className="p-4 py-3 border-b text-center no-print">Paid By</th>
                                                            <th className="p-4 py-3 border-b w-24 no-print"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.rides.map(req => (
                                                            <tr key={req.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50 tr-transition">
                                                                <td className="p-4">
                                                                    <div className="font-bold text-slate-800">{getName(req)}</div>
                                                                    <div className="text-xs text-slate-400">{getPhone(req)}</div>
                                                                </td>
                                                                <td className="p-4 hidden md:table-cell text-slate-600">
                                                                    {renderAddressCell(req)}
                                                                </td>
                                                                <td className="p-4 text-right font-bold text-green-700">
                                                                    ${(req.exact_price || 0).toFixed(2)}
                                                                </td>
                                                                <td className="p-4 text-center no-print">
                                                                    {renderPaidByDropdown(req)}
                                                                </td>
                                                                <td className="p-4 text-right no-print">
                                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                                        <button onClick={(e) => openEditModal(req, e)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                                                            <Edit size={16} />
                                                                        </button>
                                                                        <button onClick={(e) => deleteRequest(req.id, e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Content: By Person */}
                        {activeTab === 'person' && (
                            <div className="space-y-6">
                                {groupedByPerson.map((group, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div
                                            className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => setExpandedPersons(prev => ({ ...prev, [group.name]: !prev[group.name] }))}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg">
                                                    {group.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                        {group.name}
                                                        <span className="text-xs font-medium text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full ml-2">
                                                            {group.rides.length} rides
                                                        </span>
                                                    </h3>
                                                    <p className="text-xs text-slate-500 font-mono">{group.phone}</p>
                                                </div>
                                            </div>
                                            <div className="text-lg font-black text-[#1a237e] bg-[#1a237e]/10 px-4 py-1.5 rounded-lg">
                                                ${group.totalCost.toFixed(2)}
                                            </div>
                                        </div>
                                        {(expandedPersons[group.name] || (typeof window !== 'undefined' && window.matchMedia('print').matches)) && (
                                            <div className="p-0 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-[#f8fafc] text-xs uppercase text-slate-500 font-bold">
                                                        <tr>
                                                            <th className="p-4 py-3 border-b w-1/4">Date</th>
                                                            <th className="p-4 py-3 border-b">Route</th>
                                                            <th className="p-4 py-3 border-b border-r border-transparent">Price</th>
                                                            <th className="p-4 py-3 border-b text-center no-print">Paid By</th>
                                                            <th className="p-4 py-3 border-b w-24 no-print"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.rides.map(req => (
                                                            <tr key={req.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                                                <td className="p-4 text-slate-500 text-xs">
                                                                    {new Date(req.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="font-semibold text-slate-700">{req.resolved_area || 'Unknown'}</div>
                                                                    <div className="text-xs text-slate-400 truncate max-w-[200px] md:max-w-md">{getDropoff(req)}</div>
                                                                    {req.corrected_dropoff && req.dropoff_address !== req.corrected_dropoff && (
                                                                        <div className="text-[10px] text-slate-300">(orig: {req.dropoff_address})</div>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-right font-bold text-green-700">
                                                                    ${(req.exact_price || 0).toFixed(2)}
                                                                </td>
                                                                <td className="p-4 text-center no-print">
                                                                    {renderPaidByDropdown(req)}
                                                                </td>
                                                                <td className="p-4 text-right no-print">
                                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                                        <button onClick={(e) => openEditModal(req, e)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                                                            <Edit size={16} />
                                                                        </button>
                                                                        <button onClick={(e) => deleteRequest(req.id, e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
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

                                {/* Paid By Breakdown */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 text-center shadow-sm">
                                        <p className="text-sm font-bold text-blue-600 uppercase tracking-wide">Grant Total</p>
                                        <p className="text-3xl font-black text-blue-700 mt-2">${grantTotal.toFixed(2)}</p>
                                        <p className="text-xs text-blue-400 mt-1">{filteredRequests.filter(r => (r.paid_by || 'grant') === 'grant').length} rides</p>
                                    </div>
                                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-center shadow-sm">
                                        <p className="text-sm font-bold text-amber-600 uppercase tracking-wide">Shliach Total</p>
                                        <p className="text-3xl font-black text-amber-700 mt-2">${shliachTotal.toFixed(2)}</p>
                                        <p className="text-xs text-amber-400 mt-1">{filteredRequests.filter(r => r.paid_by === 'shliach').length} rides</p>
                                    </div>
                                    <div className="bg-green-50 p-6 rounded-2xl border border-green-200 text-center shadow-sm">
                                        <p className="text-sm font-bold text-green-600 uppercase tracking-wide">House Visits Total</p>
                                        <p className="text-3xl font-black text-green-700 mt-2">${houseVisitsTotal.toFixed(2)}</p>
                                        <p className="text-xs text-green-400 mt-1">{filteredRequests.filter(r => r.paid_by === 'house_visits').length} rides</p>
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

            {/* Edit Modal */}
            {editingRequest && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Edit size={18} className="text-[#1a237e]" /> Edit Record
                            </h2>
                            <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 font-bold focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                                    <input
                                        type="text"
                                        value={editForm.phone}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editForm.price}
                                        onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 font-bold focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Resolved Area</label>
                                    <input
                                        type="text"
                                        value={editForm.area}
                                        onChange={e => setEditForm({ ...editForm, area: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pickup Address</label>
                                <input
                                    type="text"
                                    value={editForm.pickup}
                                    onChange={e => setEditForm({ ...editForm, pickup: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dropoff Address</label>
                                <input
                                    type="text"
                                    value={editForm.dropoff}
                                    onChange={e => setEditForm({ ...editForm, dropoff: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-800 focus:ring-2 focus:ring-[#1a237e] focus:border-transparent outline-none text-sm"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
                            <button onClick={closeEditModal} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={saveEdit}
                                disabled={isSaving}
                                className="px-4 py-2 bg-[#1a237e] text-white font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-800 transition-colors disabled:opacity-50"
                            >
                                <Save size={18} /> {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

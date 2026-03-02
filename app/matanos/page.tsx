"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Lock, LogOut, DollarSign, History, CheckCircle2 } from "lucide-react";

type Pledge = {
    id: string;
    contact_id: string;
    amount: number;
    is_distributed: boolean;
    is_paid_by_student: boolean;
    created_at: string;
    contacts?: {
        name: string;
        phone_number: string;
    };
};

export default function MatanosDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pinInput, setPinInput] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [validPin, setValidPin] = useState("6363");

    const [pledges, setPledges] = useState<Pledge[]>([]);
    const [view, setView] = useState<'live' | 'settlement'>('live');

    // Load PIN
    useEffect(() => {
        async function fetchPin() {
            const { data } = await supabase
                .from("settings")
                .select("value")
                .eq("key", "matanos_pin")
                .single();
            if (data && data.value) setValidPin(data.value.replace(/"/g, ''));
            setLoading(false);
        }
        fetchPin();
    }, []);

    // Load Pledges
    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchPledges = async () => {
            const { data, error } = await supabase
                .from('matanos_pledges')
                .select(`*, contacts(name, phone_number)`)
                .order('created_at', { ascending: false });

            if (data) setPledges(data as any);
        };

        fetchPledges();

        // Listen for new pledges
        const channel = supabase
            .channel('public:matanos_pledges')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matanos_pledges' }, fetchPledges)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pinInput === validPin) {
            setIsAuthenticated(true);
            setError("");
        } else {
            setError("Incorrect PIN");
            setPinInput("");
        }
    };

    const handleCashOut = async () => {
        if (!confirm("Are you sure you want to cash out all pending pledges? This will mark them as distributed to the poor.")) return;

        const pendingIds = pledges.filter(p => !p.is_distributed).map(p => p.id);
        if (pendingIds.length === 0) return;

        await supabase
            .from('matanos_pledges')
            .update({ is_distributed: true })
            .in('id', pendingIds);
    };

    const handleMarkPaid = async (id: string, currentStatus: boolean) => {
        await supabase
            .from('matanos_pledges')
            .update({ is_paid_by_student: !currentStatus })
            .eq('id', id);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">Loading...</div>;

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-[#1a237e]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#1a237e]">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-[#1a237e] mb-2">Matanos L'Evyonim</h1>
                    <p className="text-slate-500 mb-8">Enter PIN to access distribution dashboard</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password" inputMode="numeric" pattern="[0-9]*"
                            value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                            className="w-full text-center text-2xl tracking-[0.5em] p-4 rounded-xl border-2 border-slate-200 focus:border-[#fbc02d] focus:outline-none transition-colors font-mono"
                            placeholder="••••" autoFocus
                        />
                        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                        <button type="submit" className="w-full bg-[#1a237e] text-white font-bold py-4 rounded-xl hover:bg-[#1a237e]/90 transition-colors">
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const pendingAmount = pledges.filter(p => !p.is_distributed).reduce((acc, p) => acc + p.amount, 0);
    const totalAmount = pledges.reduce((acc, p) => acc + p.amount, 0);

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1a237e]">Matanos Distribution</h1>
                        <p className="text-slate-500 text-sm">Rabbi Perlstein's Live Dashboard</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setView('live')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${view === 'live' ? 'bg-white text-[#1a237e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Live Feed</button>
                        <button onClick={() => setView('settlement')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${view === 'settlement' ? 'bg-white text-[#1a237e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Settlement</button>
                    </div>

                    <button onClick={() => setIsAuthenticated(false)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all self-end md:self-auto block">
                        <LogOut size={24} />
                    </button>
                </div>

                {view === 'live' ? (
                    <>
                        {/* Stats Cards */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#fbc02d] relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 text-[#fbc02d]/20"><DollarSign size={80} /></div>
                                <h2 className="text-slate-500 font-bold mb-2 uppercase tracking-wide text-sm relative z-10">Pending Cash Out</h2>
                                <p className="text-6xl font-black text-[#1a237e] relative z-10">${pendingAmount.toFixed(2)}</p>
                                <p className="text-slate-400 text-sm mt-4 relative z-10">New pledges waiting to be distributed</p>
                                <button
                                    onClick={handleCashOut}
                                    disabled={pendingAmount === 0}
                                    className={`mt-6 w-full py-4 rounded-xl font-bold text-lg transition-all z-10 relative
                    ${pendingAmount > 0 ? 'bg-[#1a237e] text-white hover:bg-[#1a237e]/90 shadow-lg shadow-[#1a237e]/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                >
                                    Cash Out (Set to $0)
                                </button>
                            </div>

                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-center">
                                <div className="absolute top-0 right-0 p-6 text-slate-100"><History size={80} /></div>
                                <h2 className="text-slate-500 font-bold mb-2 uppercase tracking-wide text-sm relative z-10">Historical Total Today</h2>
                                <p className="text-5xl font-black text-slate-800 relative z-10">${totalAmount.toFixed(2)}</p>
                                <p className="text-slate-400 text-sm mt-2 relative z-10">Total collected regardless of cash-outs</p>
                            </div>
                        </div>

                        {/* Live Feed List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-[#1a237e]">Live Pledges Feed</h3>
                                <span className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Live
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                {pledges.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">No pledges recorded yet.</div>
                                ) : (
                                    pledges.map(p => (
                                        <div key={p.id} className={`p-6 flex items-center justify-between transition-colors ${p.is_distributed ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
                                            <div>
                                                <p className="text-xl font-bold text-slate-800">{p.contacts?.name || 'Unknown Bocher'}</p>
                                                <p className="text-slate-500 font-mono text-sm">{p.contacts?.phone_number || 'No Number'}</p>
                                                <p className="text-slate-400 text-xs mt-1">{new Date(p.created_at).toLocaleTimeString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-black text-[#1a237e]">${p.amount.toFixed(2)}</p>
                                                {p.is_distributed ? (
                                                    <span className="inline-block mt-2 text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded">Distributed</span>
                                                ) : (
                                                    <span className="inline-block mt-2 text-xs font-bold text-[#fbc02d] bg-[#fbc02d]/10 px-2 py-1 rounded">Pending</span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    /* Settlement View */
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                            <h3 className="font-bold text-[#1a237e]">Post-Purim Settlement</h3>
                            <p className="text-sm text-slate-500">Mark who actually brought you the physical cash/check</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {pledges.map(p => (
                                <div key={p.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-lg font-bold text-slate-800">{p.contacts?.name || 'Unknown Bocher'}</p>
                                        <p className="text-slate-500 font-mono text-sm">{p.contacts?.phone_number}</p>
                                    </div>
                                    <div className="flex items-center gap-6 justify-between md:justify-end">
                                        <p className="text-2xl font-black text-[#1a237e]">${p.amount.toFixed(2)}</p>
                                        <button
                                            onClick={() => handleMarkPaid(p.id, p.is_paid_by_student)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all
                          ${p.is_paid_by_student
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'}`}
                                        >
                                            <CheckCircle2 size={18} />
                                            {p.is_paid_by_student ? 'Paid' : 'Mark as Paid'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

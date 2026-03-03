"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Lock, LogOut, DollarSign, History, CheckCircle2, XCircle, ChevronDown, ChevronUp, Printer, MessageSquare, Send } from "lucide-react";
import Link from "next/link";

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

    const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());

    const toggleContact = (key: string) => {
        setExpandedContacts(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

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

    const fetchPledges = useCallback(async () => {
        const { data } = await supabase
            .from('matanos_pledges')
            .select(`*, contacts(name, phone_number)`)
            .order('created_at', { ascending: false });

        if (data) setPledges(data as Pledge[]);
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

        fetchPledges();

        const channel = supabase
            .channel('public:matanos_pledges')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matanos_pledges' }, fetchPledges)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isAuthenticated, fetchPledges]);

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

    const [showCashOutConfirm, setShowCashOutConfirm] = useState(false);

    const handleCashOut = async () => {
        const pendingIds = pledges.filter(p => !p.is_distributed).map(p => p.id);
        if (pendingIds.length === 0) return;

        const { error } = await supabase
            .from('matanos_pledges')
            .update({ is_distributed: true })
            .in('id', pendingIds);

        if (error) {
            alert(`Error cashing out: ${error.message}`);
            return;
        }

        setShowCashOutConfirm(false);
        // Refresh the UI immediately
        await fetchPledges();
    };

    const handleMarkPaid = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('matanos_pledges')
            .update({ is_paid_by_student: !currentStatus })
            .eq('id', id);

        if (error) {
            alert(`Error updating payment status: ${error.message}`);
            return;
        }

        // Refresh the UI immediately
        await fetchPledges();
    };

    const [showMassTextModal, setShowMassTextModal] = useState(false);
    const [massTextTemplate, setMassTextTemplate] = useState("[Purim System] Reminder! You currently have {{AMOUNT}} in outstanding Matanos L'Evyonim pledges that you collected today. Please bring this cash to Rabbi Perlstein at 2801 W Albion Ave as soon as possible to settle up.");
    const [isSendingMassText, setIsSendingMassText] = useState(false);

    const handleSendMassText = async () => {
        setIsSendingMassText(true);
        const contactsToText = groupedPledges.filter(g => g.outstandingAmount > 0 && g.contact_id);

        const messagesToInsert = contactsToText.map(g => ({
            contact_id: g.contact_id,
            phone_number: g.phone_number,
            body: massTextTemplate.replace('{{AMOUNT}}', `$${g.outstandingAmount.toFixed(2)}`),
            direction: 'outbound' as const,
            status: 'queued'
        }));

        if (messagesToInsert.length > 0) {
            const { error } = await supabase.from('messages').insert(messagesToInsert);
            if (error) {
                alert(`Error sending messages: ${error.message}`);
            } else {
                alert(`Successfully queued messages for ${messagesToInsert.length} bochurim.`);
                setShowMassTextModal(false);
            }
        }
        setIsSendingMassText(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">Loading...</div>;

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-[#1a237e]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#1a237e]">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-[#1a237e] mb-2">Matanos L&apos;Evyonim</h1>
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
    const distributedAmount = pledges.filter(p => p.is_distributed).reduce((acc, p) => acc + p.amount, 0);
    const totalAmount = pledges.reduce((acc, p) => acc + p.amount, 0);
    const paidAmount = pledges.filter(p => p.is_paid_by_student).reduce((acc, p) => acc + p.amount, 0);
    const outstandingAmount = totalAmount - paidAmount;

    const getGroupedPledges = () => {
        const groups = new Map<string, {
            key: string;
            contact_id: string;
            phone_number: string;
            name: string;
            totalAmount: number;
            paidAmount: number;
            outstandingAmount: number;
            isFullyPaid: boolean;
            pledges: Pledge[];
        }>();

        pledges.forEach(p => {
            const key = p.contact_id || p.contacts?.phone_number || p.id;
            if (!groups.has(key)) {
                groups.set(key, {
                    key: key,
                    contact_id: p.contact_id || '',
                    phone_number: p.contacts?.phone_number || 'Unknown Number',
                    name: p.contacts?.name || 'Unknown Bocher',
                    totalAmount: 0,
                    paidAmount: 0,
                    outstandingAmount: 0,
                    isFullyPaid: false,
                    pledges: []
                });
            }
            const g = groups.get(key)!;
            g.pledges.push(p);
            g.totalAmount += p.amount;
            if (p.is_paid_by_student) {
                g.paidAmount += p.amount;
            } else {
                g.outstandingAmount += p.amount;
            }
        });

        return Array.from(groups.values()).map(g => {
            g.isFullyPaid = g.outstandingAmount === 0 && g.totalAmount > 0;
            return g;
        });
    };

    const groupedPledges = getGroupedPledges();

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 print:p-0 print:bg-white">
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4 no-print">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1a237e]">Matanos Distribution</h1>
                        <p className="text-slate-500 text-sm">Rabbi Perlstein&apos;s Live Dashboard</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setView('live')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${view === 'live' ? 'bg-white text-[#1a237e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Live Feed</button>
                        <button onClick={() => setView('settlement')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${view === 'settlement' ? 'bg-white text-[#1a237e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Settlement</button>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-700">← Hub</Link>
                        <button onClick={() => setIsAuthenticated(false)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all block">
                            <LogOut size={24} />
                        </button>
                    </div>
                </div>

                {view === 'live' ? (
                    <div className="no-print space-y-6">
                        {/* Stats Cards */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#fbc02d] relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 text-[#fbc02d]/20"><DollarSign size={80} /></div>
                                <h2 className="text-slate-500 font-bold mb-2 uppercase tracking-wide text-sm relative z-10">Pending Cash Out</h2>
                                <p className="text-5xl font-black text-[#1a237e] relative z-10">${pendingAmount.toFixed(2)}</p>
                                <p className="text-slate-400 text-sm mt-4 relative z-10">New pledges waiting to be distributed</p>

                                {showCashOutConfirm ? (
                                    <div className="mt-6 flex gap-3 w-full z-10 relative">
                                        <button
                                            onClick={handleCashOut}
                                            className="flex-1 py-4 rounded-xl font-bold transition-all bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-500/20"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setShowCashOutConfirm(false)}
                                            className="flex-1 py-4 rounded-xl font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowCashOutConfirm(true)}
                                        disabled={pendingAmount === 0}
                                        className={`mt-6 w-full py-4 rounded-xl font-bold text-lg transition-all z-10 relative
                                        ${pendingAmount > 0 ? 'bg-[#1a237e] text-white hover:bg-[#1a237e]/90 shadow-lg shadow-[#1a237e]/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                    >
                                        Cash Out (Distribute)
                                    </button>
                                )}
                            </div>

                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-green-200 relative overflow-hidden flex flex-col justify-center">
                                <div className="absolute top-0 right-0 p-6 text-green-100"><CheckCircle2 size={80} /></div>
                                <h2 className="text-green-600 font-bold mb-2 uppercase tracking-wide text-sm relative z-10">Already Distributed</h2>
                                <p className="text-5xl font-black text-green-600 relative z-10">${distributedAmount.toFixed(2)}</p>
                                <p className="text-slate-400 text-sm mt-2 relative z-10">Total given out so far today</p>
                            </div>

                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col justify-center">
                                <div className="absolute top-0 right-0 p-6 text-slate-100"><History size={80} /></div>
                                <h2 className="text-slate-500 font-bold mb-2 uppercase tracking-wide text-sm relative z-10">Grand Total</h2>
                                <p className="text-5xl font-black text-slate-800 relative z-10">${totalAmount.toFixed(2)}</p>
                                <p className="text-slate-400 text-sm mt-2 relative z-10">Everything collected today</p>
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
                    </div>
                ) : (
                    /* Settlement View */
                    <div className="space-y-6">
                        {/* Settlement Totals */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Owed</p>
                                <p className="text-2xl font-black text-slate-800">${totalAmount.toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-green-200 text-center">
                                <p className="text-xs font-bold text-green-600 uppercase">Paid</p>
                                <p className="text-2xl font-black text-green-600">${paidAmount.toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-red-200 text-center">
                                <p className="text-xs font-bold text-red-500 uppercase">Outstanding</p>
                                <p className="text-2xl font-black text-red-500">${outstandingAmount.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print-area">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-[#1a237e]">Post-Purim Settlement</h3>
                                    <p className="text-sm text-slate-500">Mark who actually brought you the physical cash</p>
                                </div>
                                <div className="flex gap-2 no-print">
                                    <button
                                        onClick={() => window.print()}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-all text-sm"
                                    >
                                        <Printer size={16} /> Print List
                                    </button>
                                    <button
                                        onClick={() => setShowMassTextModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#1a237e] hover:bg-[#1a237e]/90 text-white rounded-lg font-bold transition-all text-sm shadow-sm"
                                    >
                                        <MessageSquare size={16} /> Mass Text Missing
                                    </button>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {groupedPledges.map(g => (
                                    <div key={g.key} className={`transition-all ${g.isFullyPaid ? 'bg-green-50/50 opacity-60' : 'bg-white'}`}>
                                        {/* Header Row */}
                                        <div
                                            onClick={() => toggleContact(g.key)}
                                            className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50"
                                        >
                                            <div className="flex items-center gap-4">
                                                {expandedContacts.has(g.key) ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                                                <div>
                                                    <p className={`text-lg font-bold ${g.isFullyPaid ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{g.name}</p>
                                                    <p className="text-slate-500 font-mono text-sm">{g.phone_number}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 justify-between md:justify-end">
                                                <div className="text-right">
                                                    <p className={`text-2xl font-black ${g.isFullyPaid ? 'text-slate-400' : 'text-[#1a237e]'}`}>${g.totalAmount.toFixed(2)}</p>
                                                    {g.outstandingAmount > 0 && g.paidAmount > 0 && (
                                                        <p className="text-xs font-bold text-red-500">${g.outstandingAmount.toFixed(2)} remaining</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Pledges List */}
                                        {expandedContacts.has(g.key) && (
                                            <div className="bg-slate-50/50 px-4 md:px-14 pb-4 md:pb-6 space-y-2 border-t border-slate-100 pt-4">
                                                {g.pledges.map(p => (
                                                    <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                                            <span className="text-slate-500 font-medium">${p.amount.toFixed(2)}</span>
                                                            <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleMarkPaid(p.id, p.is_paid_by_student); }}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all
                                                            ${p.is_paid_by_student
                                                                    ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600 border border-green-200 hover:border-red-200'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700 border border-slate-200 hover:border-green-200'}`}
                                                        >
                                                            {p.is_paid_by_student ? (
                                                                <>
                                                                    <CheckCircle2 size={16} /> <span className="no-print">Paid ✓</span><span className="hidden print:inline text-green-700">PAID</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle size={16} className="no-print" /> <span className="no-print">Mark as Paid</span><span className="hidden print:inline text-red-500 font-bold border-b border-red-500 pb-1 w-16 inline-block text-center">_____</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mass Text Modal */}
            {showMassTextModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-xl font-bold text-[#1a237e] flex items-center gap-2">
                                <MessageSquare size={24} />
                                Mass Text Collection Reminder
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">This will send an SMS to {groupedPledges.filter(g => g.outstandingAmount > 0).length} bochurim who still have outstanding balances.</p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Message Template (Editable):</label>
                            <p className="text-xs text-slate-400 mb-2">Leave <code className="bg-slate-100 px-1 rounded text-[#1a237e]">{"{{AMOUNT}}"}</code> in the text—it will automatically be replaced with each person's specific outstanding balance.</p>
                            <textarea
                                value={massTextTemplate}
                                onChange={(e) => setMassTextTemplate(e.target.value)}
                                className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:border-[#1a237e] focus:ring-2 focus:ring-[#1a237e]/20 outline-none text-slate-700 resize-none font-medium"
                            />
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowMassTextModal(false)}
                                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendMassText}
                                disabled={isSendingMassText || groupedPledges.filter(g => g.outstandingAmount > 0).length === 0}
                                className="px-6 py-3 rounded-xl font-bold text-white bg-[#1a237e] hover:bg-[#1a237e]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSendingMassText ? 'Sending...' : (
                                    <>
                                        <Send size={18} /> Send Messages Now
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

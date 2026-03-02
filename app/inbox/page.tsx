"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Inbox, Send, ArrowLeft, User } from "lucide-react";
import Link from "next/link";

type Message = {
    id: string;
    contact_id: string;
    body: string;
    direction: 'inbound' | 'outbound';
    created_at: string;
    phone_number: string;
    contacts?: {
        name: string;
        phone_number: string;
    };
};

type Conversation = {
    phone_number: string;
    name: string | null;
    lastMessage: string;
    lastTime: string;
    unread: number;
};

export default function GeneralInbox() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activePhone, setActivePhone] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select(`*, contacts(name, phone_number)`)
            .order('created_at', { ascending: false })
            .limit(5000);

        if (data) {
            const chronological = (data as Message[]).reverse();
            setMessages(chronological);
            buildConversations(chronological);
        }
    };

    const buildConversations = (msgs: Message[]) => {
        const convMap = new Map<string, Conversation>();

        for (const msg of msgs) {
            const phone = msg.phone_number;
            if (!phone) continue;

            const existing = convMap.get(phone);
            if (!existing) {
                convMap.set(phone, {
                    phone_number: phone,
                    name: msg.contacts?.name || null,
                    lastMessage: msg.body || '',
                    lastTime: msg.created_at,
                    unread: msg.direction === 'inbound' ? 1 : 0,
                });
            } else {
                existing.lastMessage = msg.body || '';
                existing.lastTime = msg.created_at;
                if (!existing.name && msg.contacts?.name) {
                    existing.name = msg.contacts.name;
                }
            }
        }

        const sorted = Array.from(convMap.values())
            .sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
        setConversations(sorted);
    };

    useEffect(() => {
        fetchMessages();
        const channel = supabase
            .channel('public:messages_inbox')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchMessages)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activePhone, messages]);

    const activeMessages = activePhone
        ? messages.filter(m => m.phone_number === activePhone)
        : [];

    const activeConvo = conversations.find(c => c.phone_number === activePhone);

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !activePhone) return;

        const msgRef = messages.find(m => m.phone_number === activePhone);

        await supabase
            .from('messages')
            .insert({
                contact_id: msgRef?.contact_id || null,
                body: replyText,
                direction: 'outbound',
                status: 'queued',
                phone_number: activePhone
            });

        setReplyText("");
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex bg-white p-6 rounded-2xl shadow-sm border border-slate-100 items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                            <Inbox size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">General Inbox</h1>
                            <p className="text-slate-500 text-sm">{conversations.length} conversations</p>
                        </div>
                    </div>
                    <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-700">← Back Hub</Link>
                </div>

                {/* Chat Layout */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex" style={{ height: '70vh' }}>

                    {/* Left: Contact List */}
                    <div className="w-80 border-r border-slate-100 flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contacts</p>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                            {conversations.map(convo => (
                                <button
                                    key={convo.phone_number}
                                    onClick={() => setActivePhone(convo.phone_number)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${activePhone === convo.phone_number ? 'bg-[#1a237e]/5 border-l-4 border-[#1a237e]' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#1a237e]/10 rounded-full flex items-center justify-center text-[#1a237e] shrink-0">
                                            <User size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{convo.name || convo.phone_number}</p>
                                            {convo.name && <p className="text-xs text-slate-400 font-mono">{convo.phone_number}</p>}
                                            <p className="text-xs text-slate-400 truncate mt-1">{convo.lastMessage}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-300 whitespace-nowrap">
                                            {new Date(convo.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </button>
                            ))}
                            {conversations.length === 0 && (
                                <p className="text-center text-slate-400 py-12 text-sm">No conversations yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Right: Chat Thread */}
                    <div className="flex-1 flex flex-col">
                        {activePhone ? (
                            <>
                                {/* Chat Header */}
                                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                                    <button onClick={() => setActivePhone(null)} className="md:hidden text-slate-400 hover:text-slate-700">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="w-10 h-10 bg-[#1a237e] text-white rounded-full flex items-center justify-center font-bold">
                                        {(activeConvo?.name || activePhone).charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{activeConvo?.name || activePhone}</p>
                                        {activeConvo?.name && <p className="text-xs text-slate-400 font-mono">{activePhone}</p>}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {activeMessages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-3 rounded-2xl max-w-[75%] ${msg.direction === 'outbound'
                                                ? 'bg-[#1a237e] text-white rounded-tr-sm'
                                                : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                                                }`}>
                                                <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                                                <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/50' : 'text-slate-400'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={bottomRef} />
                                </div>

                                {/* Reply Box */}
                                <form onSubmit={handleReply} className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                                    <input
                                        type="text"
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 p-3 rounded-xl border border-slate-200 focus:border-[#fbc02d] focus:outline-none text-sm"
                                        autoFocus
                                    />
                                    <button type="submit" className="bg-[#1a237e] text-white px-5 rounded-xl font-bold hover:bg-[#1a237e]/90 transition-colors flex items-center justify-center">
                                        <Send size={18} />
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-300 flex-col gap-4">
                                <Inbox size={48} />
                                <p className="font-medium">Select a conversation</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

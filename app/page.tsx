"use client";

import Link from "next/link";
import Image from "next/image";
import { Car, Coins, Inbox, Power } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [purimMode, setPurimMode] = useState(false);

  useEffect(() => {
    const fetchPurimMode = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'purim_mode').single();
      if (data && data.value === '"true"') setPurimMode(true);
    };
    fetchPurimMode();
  }, []);

  const togglePurimMode = async () => {
    const newVal = !purimMode;
    setPurimMode(newVal);
    await supabase.from('settings').upsert({ key: 'purim_mode', value: newVal ? '"true"' : '"false"' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">

        {/* Logos Row */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <Image src="/yeshiva-logo.jpg" alt="Yeshivas Ohr Eliyahu" width={80} height={80} className="rounded-xl shadow-sm" />
          <Image src="/logo.jpg" alt="Lubavitch Mesivta Chicago" width={80} height={80} className="rounded-xl shadow-sm" />
          <Image src="/mivtzoyim-logo.png" alt="Mivtzoyim" width={80} height={80} className="rounded-xl shadow-sm" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#1a237e] mb-2">Purim 5786 Dashboards</h1>
          <p className="text-slate-600 mb-6">Select a dashboard to manage incoming texts.</p>

          <button
            onClick={togglePurimMode}
            className={`inline-flex items-center gap-3 px-6 py-3 rounded-full font-bold transition-all shadow-sm ${purimMode
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
              : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
              }`}
          >
            <Power size={20} className={purimMode ? 'text-amber-500' : 'text-slate-400'} />
            Global AI Purim Mode: {purimMode ? 'ACTIVATED' : 'PAUSED'}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/matanos" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-[#fbc02d] transition-all group flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#1a237e]/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#1a237e] group-hover:text-white transition-colors text-[#1a237e]">
              <Coins size={32} />
            </div>
            <h2 className="text-xl font-bold text-[#1a237e] mb-2">Matanos L&apos;Evyonim</h2>
            <p className="text-sm text-slate-500">Rabbi Perlstein&apos;s distribution dashboard</p>
          </Link>

          <Link href="/ubers" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-[#fbc02d] transition-all group flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#1a237e]/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#1a237e] group-hover:text-white transition-colors text-[#1a237e]">
              <Car size={32} />
            </div>
            <h2 className="text-xl font-bold text-[#1a237e] mb-2">Uber Requests</h2>
            <p className="text-sm text-slate-500">View and book student rides</p>
          </Link>

          <Link href="/inbox" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-[#fbc02d] transition-all group flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#1a237e]/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#1a237e] group-hover:text-white transition-colors text-[#1a237e]">
              <Inbox size={32} />
            </div>
            <h2 className="text-xl font-bold text-[#1a237e] mb-2">General Inbox</h2>
            <p className="text-sm text-slate-500">Catch-all for unrecognized texts</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { getChallenges } from '@/lib/firebase';
import { ThumbsUp, ThumbsDown, EyeOff, Zap, Repeat } from 'lucide-react';

export default function BonusMalusList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [view, setView] = useState('bonus'); // 'bonus' | 'malus' | 'hidden'
  const [loading, setLoading] = useState(true);

  // Se non è matricola, può vedere il tab "Segreti"
  const canSeeHidden = currentUser && currentUser.role !== 'matricola';

  useEffect(() => {
    const load = async () => {
      const data = await getChallenges();
      setChallenges(data);
      setLoading(false);
    };
    load();
  }, []);

  // 1. FILTRO GENERALE (Cosa mostrare nel tab attivo)
  const getTabItems = () => {
    return challenges.filter(c => {
      // TAB SEGRETI (Solo Admin/Utenti)
      if (view === 'hidden') return c.hidden;

      // Se non siamo nel tab segreti, nascondi sempre i nascosti
      if (c.hidden) return false;

      // TAB BONUS vs MALUS
      if (view === 'bonus') return c.punti > 0;
      if (view === 'malus') return c.punti < 0;

      return false;
    });
  };

  const currentItems = getTabItems();

  // 2. RAGGRUPPAMENTO (One Shot vs Daily)
  // Questo serve per mettere il divisore in mezzo alla lista
  const oneShotItems = currentItems.filter(c => c.type !== 'daily');
  const dailyItems = currentItems.filter(c => c.type === 'daily');

  // Funzione per renderizzare una singola card
  const renderCard = (c) => {
    const isBonus = c.punti > 0;
    return (
      <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between bg-white shadow-sm mb-2 ${isBonus ? 'border-green-100' : 'border-red-100'}`}>
        <div className="flex items-center gap-3">
            <span className="text-2xl filter drop-shadow-sm">{c.icon}</span>
            <div>
                <h3 className={`font-bold leading-tight ${isBonus ? 'text-green-900' : 'text-red-900'}`}>{c.titolo}</h3>
                {c.hidden && <span className="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded mt-1 inline-block">NASCOSTO</span>}
            </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-black text-sm ${isBonus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isBonus ? '+' : ''}{c.punti}
        </div>
      </div>
    );
  };

  if (loading) return <div className="text-center py-12">Caricamento lista...</div>;

  return (
    <div>
      {/* Intestazione */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Lista Ufficiale</h2>
        <p className="text-gray-500 text-sm">Regolamento Bonus & Malus</p>
      </div>

      {/* Switcher Tab (Bonus / Malus / Segreti) */}
      <div className="bg-gray-200 p-1 rounded-xl mb-6 flex">
        <button 
          onClick={() => setView('bonus')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'bonus' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}
        >
          <ThumbsUp size={18} /> Bonus
        </button>
        <button 
          onClick={() => setView('malus')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'malus' ? 'bg-white shadow text-red-700' : 'text-gray-500'}`}
        >
          <ThumbsDown size={18} /> Malus
        </button>
        
        {canSeeHidden && (
            <button 
            onClick={() => setView('hidden')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'hidden' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >
            <EyeOff size={18} /> Segreti
            </button>
        )}
      </div>

      {/* LISTA RAGGRUPPATA */}
      <div className="pb-10">
        
        {/* Caso Lista Vuota */}
        {currentItems.length === 0 && (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                Nessun elemento in questa sezione.
            </div>
        )}

        {/* 1. SEZIONE ONE SHOT */}
        {oneShotItems.length > 0 && (
            <div className="mb-4">
                {/* Mostriamo l'intestazione solo se non siamo nel tab "Segreti" (lì mischiamo tutto o mostriamo tutto) */}
                {view !== 'hidden' && (
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
                        <Zap size={14} /> Una Tantum (One Shot)
                    </h3>
                )}
                {oneShotItems.map(renderCard)}
            </div>
        )}

        {/* 2. DIVISORE (Solo se ci sono entrambi) */}
        {oneShotItems.length > 0 && dailyItems.length > 0 && view !== 'hidden' && (
            <div className="flex items-center gap-2 my-6 opacity-50">
                <div className="h-px bg-gray-300 flex-1"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Oppure</span>
                <div className="h-px bg-gray-300 flex-1"></div>
            </div>
        )}

        {/* 3. SEZIONE DAILY */}
        {dailyItems.length > 0 && (
            <div>
                 {view !== 'hidden' && (
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
                        <Repeat size={14} /> Ripetibili (Daily)
                    </h3>
                 )}
                {dailyItems.map(renderCard)}
            </div>
        )}
      </div>
    </div>
  );
}
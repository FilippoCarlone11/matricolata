'use client';

import { useState, useEffect } from 'react';
import { getChallenges } from '@/lib/firebase';
import { ThumbsUp, ThumbsDown, EyeOff, Zap, Repeat } from 'lucide-react';

export default function BonusMalusList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [view, setView] = useState('bonus'); // 'bonus' | 'malus' | 'hidden'
  const [loading, setLoading] = useState(true);

  // Verifica permessi: Se currentUser esiste e NON è matricola, può vedere i segreti
  const canSeeHidden = currentUser && currentUser.role !== 'matricola';

  useEffect(() => {
    const load = async () => {
      const data = await getChallenges();
      setChallenges(data);
      setLoading(false);
    };
    load();
  }, []);

  // FILTRO LOGICO
  const filteredList = challenges.filter(c => {
    // 1. GESTIONE TAB "SEGRETI"
    if (view === 'hidden') {
        // Se siamo nel tab segreti, mostriamo SOLO i nascosti (sia bonus che malus)
        return c.hidden === true;
    }

    // 2. GESTIONE TAB NORMALI (Bonus/Malus)
    // Prima regola: Se è nascosto, NON mostrarlo qui (va nel tab segreti)
    if (c.hidden) return false;

    // Seconda regola: Filtra per tipo
    if (view === 'bonus') return c.punti > 0;
    if (view === 'malus') return c.punti < 0;

    return false;
  });

  // RAGGRUPPAMENTO VISIVO (One Shot vs Daily) all'interno del tab corrente
  const oneShotItems = filteredList.filter(c => c.type !== 'daily');
  const dailyItems = filteredList.filter(c => c.type === 'daily');

  // Funzione per renderizzare la singola card
  const renderCard = (c) => {
    const isBonus = c.punti > 0;
    // Colori dinamici: Verde se bonus, Rosso se malus (anche dentro i segreti)
    const borderColor = isBonus ? 'border-green-100' : 'border-red-100';
    const textColor = isBonus ? 'text-green-900' : 'text-red-900';
    const badgeBg = isBonus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

    return (
      <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between bg-white shadow-sm mb-2 ${borderColor}`}>
        <div className="flex items-center gap-3">
            <span className="text-2xl filter drop-shadow-sm">{c.icon}</span>
            <div>
                <h3 className={`font-bold leading-tight ${textColor}`}>{c.titolo}</h3>
                {c.hidden && <span className="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded mt-1 inline-block flex w-fit items-center gap-1"><EyeOff size={8}/> NASCOSTO</span>}
            </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-black text-sm ${badgeBg}`}>
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
        <p className="text-gray-500 text-sm">
            {view === 'hidden' ? 'Bonus e Malus Segreti' : 'Regolamento Bonus & Malus'}
        </p>
      </div>

      {/* Switcher Tab */}
      <div className="bg-gray-200 p-1 rounded-xl mb-6 flex">
        <button 
          onClick={() => setView('bonus')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'bonus' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ThumbsUp size={18} /> Bonus
        </button>
        <button 
          onClick={() => setView('malus')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'malus' ? 'bg-white shadow text-red-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ThumbsDown size={18} /> Malus
        </button>
        
        {/* Tab Segreti (Visibile solo se NON matricola) */}
        {canSeeHidden && (
            <button 
            onClick={() => setView('hidden')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'hidden' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
            <EyeOff size={18} /> Segreti
            </button>
        )}
      </div>

      {/* CONTENUTO LISTA */}
      <div className="pb-10">
        
        {filteredList.length === 0 && (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                Nessun elemento presente in questa sezione.
            </div>
        )}

        {/* 1. SEZIONE ONE SHOT */}
        {oneShotItems.length > 0 && (
            <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
                    <Zap size={14} /> Una Tantum (One Shot)
                </h3>
                {oneShotItems.map(renderCard)}
            </div>
        )}

        {/* 2. DIVISORE (Solo se ci sono entrambi) */}
        {oneShotItems.length > 0 && dailyItems.length > 0 && (
            <div className="flex items-center gap-2 my-6 opacity-50">
                <div className="h-px bg-gray-300 flex-1"></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Oppure</span>
                <div className="h-px bg-gray-300 flex-1"></div>
            </div>
        )}

        {/* 3. SEZIONE DAILY */}
        {dailyItems.length > 0 && (
            <div>
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
                    <Repeat size={14} /> Ripetibili (Daily)
                 </h3>
                {dailyItems.map(renderCard)}
            </div>
        )}
      </div>
    </div>
  );
}
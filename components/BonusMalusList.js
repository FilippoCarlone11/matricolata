'use client';

import { useState, useEffect } from 'react';
import { getChallenges } from '@/lib/firebase';
import { ThumbsUp, ThumbsDown, EyeOff, Zap, Repeat, Lock } from 'lucide-react';

export default function BonusMalusList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [view, setView] = useState('bonus'); // 'bonus' | 'malus'
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

  // 1. FILTRO BASE (Bonus vs Malus)
  const currentTabItems = challenges.filter(c => {
    if (view === 'bonus') return c.punti > 0;
    if (view === 'malus') return c.punti < 0;
    return false;
  });

  // 2. SEPARAZIONE VISIBILI / NASCOSTI
  const visibleItems = currentTabItems.filter(c => !c.hidden);
  const hiddenItems = currentTabItems.filter(c => c.hidden);

  // 3. RAGGRUPPAMENTO VISIBILI (One Shot vs Daily)
  const visibleOneShot = visibleItems.filter(c => c.type !== 'daily');
  const visibleDaily = visibleItems.filter(c => c.type === 'daily');

  // Funzione Rendering Card
  const renderCard = (c, isHiddenSection = false) => {
    const isBonus = c.punti > 0;
    // Se siamo nella sezione nascosta, usiamo colori più scuri/grigi per differenziare, oppure manteniamo i colori standard
    // Qui mantengo i colori standard ma aggiungo il badge evidente
    const borderColor = isBonus ? 'border-green-100' : 'border-red-100';
    const textColor = isBonus ? 'text-green-900' : 'text-red-900';
    const badgeBg = isBonus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

    return (
      <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between bg-white shadow-sm mb-2 ${borderColor} ${isHiddenSection ? 'bg-gray-50' : ''}`}>
        <div className="flex items-center gap-3">
            <span className="text-2xl filter drop-shadow-sm">{c.icon}</span>
            <div>
                <h3 className={`font-bold leading-tight ${textColor}`}>{c.titolo}</h3>
                {isHiddenSection && (
                    <span className="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded mt-1 inline-flex items-center gap-1">
                        <EyeOff size={8}/> SEGRETO
                    </span>
                )}
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
        <p className="text-gray-500 text-sm">Regolamento Bonus & Malus</p>
      </div>

      {/* Switcher Tab (SOLO 2 ORA) */}
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
      </div>

      {/* CONTENUTO */}
      <div className="pb-10">
        
        {/* === PARTE PUBBLICA (Visibile a tutti) === */}
        
        {visibleItems.length === 0 && (
             <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl mb-4">
                Nessun elemento pubblico qui.
            </div>
        )}

        {/* 1. One Shot Pubblici */}
        {visibleOneShot.length > 0 && (
            <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
                    <Zap size={14} /> Una Tantum
                </h3>
                {visibleOneShot.map(c => renderCard(c, false))}
            </div>
        )}

        {/* Divisore interno OneShot/Daily */}
        {visibleOneShot.length > 0 && visibleDaily.length > 0 && (
            <div className="flex items-center gap-2 my-6 opacity-30">
                <div className="h-px bg-gray-400 flex-1"></div>
                <div className="h-px bg-gray-400 flex-1"></div>
            </div>
        )}

        {/* 2. Daily Pubblici */}
        {visibleDaily.length > 0 && (
            <div className="mb-6">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2 px-1">
                    <Repeat size={14} /> Giornalieri
                 </h3>
                {visibleDaily.map(c => renderCard(c, false))}
            </div>
        )}


        {/* === PARTE SEGRETA (Visibile solo a Non-Matricole) === */}
        
        {canSeeHidden && hiddenItems.length > 0 && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                
                {/* Divisore Speciale Segreti */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-0.5 bg-gray-800 flex-1 rounded-full"></div>
                    <span className="text-[10px] font-black text-gray-800 uppercase bg-gray-200 px-3 py-1 rounded-full flex items-center gap-1">
                        <Lock size={10} /> Area Segreta
                    </span>
                    <div className="h-0.5 bg-gray-800 flex-1 rounded-full"></div>
                </div>

                <div className="bg-gray-100 p-3 rounded-2xl border border-gray-200">
                    <p className="text-center text-[10px] text-gray-500 mb-3">
                        Questi elementi sono nascosti alle matricole.
                    </p>
                    {hiddenItems.map(c => renderCard(c, true))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
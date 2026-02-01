'use client';

import { useState, useEffect } from 'react';
import { getChallenges } from '@/lib/firebase';
import { ThumbsUp, ThumbsDown, EyeOff, Zap, Repeat, Lock, RotateCcw } from 'lucide-react';

export default function BonusMalusList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [view, setView] = useState('bonus'); 
  const [loading, setLoading] = useState(true);
  
  // Stato per tracciare quale card è girata (solo una alla volta o multiple)
  const [flippedId, setFlippedId] = useState(null);

  const canSeeHidden = currentUser && currentUser.role !== 'matricola';

  useEffect(() => {
    const load = async () => {
      const data = await getChallenges();
      setChallenges(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleCardClick = (id) => {
    // Se clicco sulla stessa, la chiudo (null), altrimenti apro quella nuova
    setFlippedId(flippedId === id ? null : id);
  };

  const currentTabItems = challenges.filter(c => {
    if (view === 'bonus') return c.punti > 0;
    if (view === 'malus') return c.punti < 0;
    return false;
  });

  const visibleItems = currentTabItems.filter(c => !c.hidden);
  const hiddenItems = currentTabItems.filter(c => c.hidden);

  const visibleOneShot = visibleItems.filter(c => c.type !== 'daily');
  const visibleDaily = visibleItems.filter(c => c.type === 'daily');

  // --- RENDERIZZA CARD (Con effetto Flip) ---
  const renderCard = (c, isHiddenSection = false) => {
    const isBonus = c.punti > 0;
    const isFlipped = flippedId === c.id;

    // Colori Fronte
    const borderColor = isBonus ? 'border-green-100' : 'border-red-100';
    const textColor = isBonus ? 'text-green-900' : 'text-red-900';
    const badgeBg = isBonus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    
    // Colori Retro (Descrizione)
    const backBg = isBonus ? 'bg-green-50' : 'bg-red-50';

    return (
      <div 
        key={c.id} 
        onClick={() => handleCardClick(c.id)}
        className="relative w-full h-20 mb-3 cursor-pointer perspective-1000 group"
        style={{ perspective: '1000px' }} // Fallback style
      >
        {/* INNER CONTAINER (Quello che ruota) */}
        <div 
            className={`relative w-full h-full duration-500 transition-all preserve-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            style={{ transformStyle: 'preserve-3d' }}
        >
            
            {/* --- FRONTE DELLA CARD --- */}
            <div 
                className={`absolute inset-0 backface-hidden p-4 rounded-xl border flex items-center justify-between bg-white shadow-sm ${borderColor} ${isHiddenSection ? 'opacity-80' : ''}`}
                style={{ backfaceVisibility: 'hidden' }}
            >
                <div className="flex items-center gap-3">
                    <span className="text-3xl filter drop-shadow-sm">{c.icon}</span>
                    <div>
                        <h3 className={`font-bold leading-tight text-sm ${textColor}`}>{c.titolo}</h3>
                        <div className="flex gap-2 mt-1">
                            {isHiddenSection && (
                                <span className="text-[9px] bg-gray-800 text-white px-1.5 rounded flex items-center gap-1">
                                    <EyeOff size={8}/> Segreto
                                </span>
                            )}
                            {/* Mostra "Tap per info" se c'è descrizione */}
                            {c.description && (
                                <span className="text-[9px] text-gray-400 flex items-center gap-1 animate-pulse">
                                    <RotateCcw size={8}/> Info
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg font-black text-sm ${badgeBg}`}>
                    {isBonus ? '+' : ''}{c.punti}
                </div>
            </div>

            {/* --- RETRO DELLA CARD (Descrizione) --- */}
            <div 
                className={`absolute inset-0 backface-hidden p-4 rounded-xl border flex flex-col justify-center items-center text-center shadow-inner ${backBg} ${borderColor} [transform:rotateY(180deg)]`}
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
                <p className="text-xs text-gray-600 font-medium leading-relaxed px-2">
                    {c.description || "Nessuna descrizione disponibile."}
                </p>
                <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-wider">
                    {/* MODIFICA NOMI QUI */}
                    {c.type === 'daily' ? 'GIORNALIERO' : 'SPECIALE'}
                </span>
            </div>

        </div>
      </div>
    );
  };

  if (loading) return <div className="text-center py-12">Caricamento lista...</div>;

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Regolamento</h2>
        <p className="text-gray-400 text-xs mt-1">Tocca una card per leggere i dettagli</p>
      </div>

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

      <div className="pb-10 px-1">
        
        {visibleItems.length === 0 && (
             <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl mb-4">
                Nessun elemento pubblico.
            </div>
        )}

        {/* 1. Bonus Speciali */}
        {visibleOneShot.length > 0 && (
            <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 px-1">
                    <Zap size={14} /> Speciali
                </h3>
                {visibleOneShot.map(c => renderCard(c, false))}
            </div>
        )}

        {/* 2. Giornalieri */}
        {visibleDaily.length > 0 && (
            <div className="mb-6">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 px-1">
                    <Repeat size={14} /> Giornalieri
                 </h3>
                {visibleDaily.map(c => renderCard(c, false))}
            </div>
        )}

        {/* Segreti */}
        {canSeeHidden && hiddenItems.length > 0 && (
            <div className="mt-8 pt-4 border-t border-dashed border-gray-300">
                <div className="flex justify-center mb-4">
                    <span className="text-[10px] font-black text-white uppercase bg-gray-800 px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <Lock size={10} /> Area Segreta
                    </span>
                </div>
                {hiddenItems.map(c => renderCard(c, true))}
            </div>
        )}

      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { getChallenges } from '@/lib/firebase';
import { Zap, Repeat, EyeOff } from 'lucide-react';

export default function BonusMalusList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [view, setView] = useState('oneshot'); // 'oneshot' | 'daily' | 'hidden'
  const [loading, setLoading] = useState(true);

  // Controllo ruolo per vedere se mostrare tab Nascosti
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
  const list = challenges.filter(c => {
    if (view === 'hidden') return c.hidden; // Mostra solo nascosti
    if (c.hidden) return false; // Se non siamo nel tab hidden, nascondili sempre

    if (view === 'daily') return c.type === 'daily';
    if (view === 'oneshot') return c.type !== 'daily'; // Default oneshot
    return false;
  });

  if (loading) return <div className="text-center py-12">Caricamento lista...</div>;

  return (
    <div>
      {/* Intestazione */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Lista Ufficiale</h2>
        <p className="text-gray-500 text-sm">Regolamento Bonus & Malus</p>
      </div>

      {/* Switcher Tab - 3 Opzioni */}
      <div className="bg-gray-200 p-1 rounded-xl mb-6 flex">
        <button 
          onClick={() => setView('oneshot')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex justify-center items-center gap-1 transition-all ${view === 'oneshot' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}
        >
          <Zap size={14} /> One Shot
        </button>
        <button 
          onClick={() => setView('daily')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex justify-center items-center gap-1 transition-all ${view === 'daily' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}
        >
          <Repeat size={14} /> Daily
        </button>
        
        {/* Tab Nascosti (Solo se non matricola) */}
        {canSeeHidden && (
            <button 
            onClick={() => setView('hidden')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex justify-center items-center gap-1 transition-all ${view === 'hidden' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >
            <EyeOff size={14} /> Segreti
            </button>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {list.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nessuna voce presente in questa categoria.</div>
        ) : (
            list.map(c => {
                const isBonus = c.punti > 0;
                return (
                <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between bg-white ${isBonus ? 'border-green-100 shadow-sm' : 'border-red-100 shadow-sm'}`}>
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
            )})
        )}
      </div>
    </div>
  );
}
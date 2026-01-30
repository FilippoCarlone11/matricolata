'use client';

import { useState, useEffect } from 'react';
import { getChallenges } from '@/lib/firebase';
import { ThumbsUp, ThumbsDown, EyeOff } from 'lucide-react';

export default function BonusMalusList() {
  const [challenges, setChallenges] = useState([]);
  const [view, setView] = useState('bonus'); // 'bonus' | 'malus'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getChallenges();
      setChallenges(data);
      setLoading(false);
    };
    load();
  }, []);

  // FILTRO: 
  // 1. Tipo (Bonus > 0 / Malus < 0)
  // 2. Visibilità (!hidden) -> LE MATRICOLE NON VEDONO QUELLI NASCOSTI
  const list = challenges.filter(c => {
    const isCorrectType = view === 'bonus' ? c.punti > 0 : c.punti < 0;
    const isVisible = !c.hidden; 
    return isCorrectType && isVisible;
  });

  if (loading) return <div className="text-center py-12">Caricamento lista...</div>;

  return (
    <div>
      {/* Intestazione */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Lista Ufficiale</h2>
        <p className="text-gray-500 text-sm">Consulta tutti i bonus e malus pubblici</p>
      </div>

      {/* Switcher Tab */}
      <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
        <button 
          onClick={() => setView('bonus')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'bonus' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ThumbsUp size={18} /> Elenco Bonus
        </button>
        <button 
          onClick={() => setView('malus')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'malus' ? 'bg-white shadow text-red-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ThumbsDown size={18} /> Elenco Malus
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {list.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nessun {view} pubblico presente.</div>
        ) : (
            list.map(c => (
                <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between ${view === 'bonus' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl filter drop-shadow-sm">{c.icon}</span>
                        <div>
                            <h3 className={`font-bold leading-tight ${view === 'bonus' ? 'text-green-900' : 'text-red-900'}`}>{c.titolo}</h3>
                            <div className="flex gap-2 mt-1">
                                {c.type === 'daily' && <span className="text-[10px] uppercase font-bold text-purple-500 border border-purple-200 px-1 rounded bg-white">Giornaliero</span>}
                            </div>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg font-black text-sm ${view === 'bonus' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {view === 'bonus' ? '+' : ''}{c.punti}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { getLeaderboards } from '@/lib/firebase';
import { Trophy, User, Users, Shield } from 'lucide-react';

export default function Classifiche() {
  const [data, setData] = useState({ matricole: [], fantallenatori: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('fanta'); // Partiamo mostrando i Fantallenatori di default

  useEffect(() => {
    const load = async () => {
      const res = await getLeaderboards();
      setData(res);
      setLoading(false);
    };
    load();
  }, []);

  const List = ({ items, isFanta }) => (
    <div className="space-y-3">
      {items.map((item, index) => {
        let medalColor = 'bg-white border-gray-200';
        let rankIcon = <span className="font-black text-xl text-gray-400 italic w-8 text-center">#{index + 1}</span>;
        
        if (index === 0) { medalColor = 'bg-yellow-50 border-yellow-300'; rankIcon = <Trophy className="text-yellow-500 w-8" />; }
        if (index === 1) { medalColor = 'bg-slate-50 border-slate-300'; rankIcon = <span className="font-black text-xl text-slate-400 w-8 text-center">2</span>; }
        if (index === 2) { medalColor = 'bg-orange-50 border-orange-200'; rankIcon = <span className="font-black text-xl text-orange-400 w-8 text-center">3</span>; }

        // LOGICA VISUALIZZAZIONE NOMI
        // Se è fanta: Titolo = Nome Squadra (o Nome Utente se manca). Sottotitolo = Nome Utente.
        const title = isFanta ? (item.teamName || item.displayName) : item.displayName;
        const subTitle = isFanta ? item.displayName : 'Matricola';

        return (
          <div key={item.id} className={`flex items-center p-3 rounded-2xl border-2 shadow-sm ${medalColor}`}>
            {rankIcon}
            <img src={item.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full object-cover mx-3 border border-gray-100" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate text-lg leading-tight">{title}</h3>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                {isFanta && item.teamName && <User size={10} />}
                {subTitle}
              </p>
            </div>
            <div className="text-right pl-2">
              <span className="block text-2xl font-black text-gray-800 leading-none">{isFanta ? item.fantaPunti : item.punti}</span>
              <span className="text-[9px] uppercase font-bold text-gray-400">Pt</span>
            </div>
          </div>
        );
      })}
      {items.length === 0 && <p className="text-center text-gray-500 py-8">Nessun dato in classifica.</p>}
    </div>
  );

  if (loading) return <div className="text-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div></div>;

  return (
    <div>
      {/* Switcher */}
      <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
        <button 
          onClick={() => setView('fanta')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'fanta' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          <Shield size={16} /> Squadre
        </button>
        <button 
          onClick={() => setView('matricole')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'matricole' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          <Users size={16} /> Matricole
        </button>
      </div>

      <List items={view === 'matricole' ? data.matricole : data.fantallenatori} isFanta={view === 'fanta'} />
    </div>
  );
}
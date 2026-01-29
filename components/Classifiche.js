'use client';

import { useState, useEffect } from 'react';
import { getLeaderboards } from '@/lib/firebase';
import { Trophy, Medal, User, Users } from 'lucide-react';

export default function Classifiche() {
  const [data, setData] = useState({ matricole: [], fantallenatori: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('matricole'); // 'matricole' o 'fanta'

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
        if (index === 0) medalColor = 'bg-yellow-50 border-yellow-300';
        if (index === 1) medalColor = 'bg-slate-50 border-slate-300';
        if (index === 2) medalColor = 'bg-orange-50 border-orange-200';

        return (
          <div key={item.id} className={`flex items-center p-4 rounded-2xl border-2 shadow-sm ${medalColor}`}>
            <div className="font-black text-xl w-8 text-gray-400 italic">#{index + 1}</div>
            <img src={item.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full object-cover mx-3" />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{item.displayName}</h3>
              {isFanta && item.mySquad && <p className="text-xs text-gray-500">{item.mySquad.length} giocatori in rosa</p>}
            </div>
            <div className="text-right">
              <span className="block text-2xl font-black text-gray-800">{isFanta ? item.fantaPunti : item.punti}</span>
              <span className="text-[10px] uppercase font-bold text-gray-400">Punti</span>
            </div>
          </div>
        );
      })}
      {items.length === 0 && <p className="text-center text-gray-500 py-8">Nessun dato in classifica.</p>}
    </div>
  );

  if (loading) return <div className="text-center py-12">Calcolo classifiche...</div>;

  return (
    <div>
      {/* Switcher */}
      <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
        <button 
          onClick={() => setView('matricole')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'matricole' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          <User size={16} /> Matricole
        </button>
        <button 
          onClick={() => setView('fanta')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'fanta' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
        >
          <Users size={16} /> Fantallenatori
        </button>
      </div>

      <div className="mb-4 flex items-center justify-center gap-2 text-gray-800">
        <Trophy className="text-yellow-500" />
        <h2 className="text-xl font-bold">Top {view === 'matricole' ? 'Matricole' : 'Squadre'}</h2>
      </div>

      <List items={view === 'matricole' ? data.matricole : data.fantallenatori} isFanta={view === 'fanta'} />
    </div>
  );
}
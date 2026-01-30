'use client';

import { useState, useEffect } from 'react';
import { getLeaderboards, getFullSquadDetails } from '@/lib/firebase';
import { Trophy, User, Users, Shield, X, Crown } from 'lucide-react';

export default function Classifiche() {
  const [data, setData] = useState({ matricole: [], fantallenatori: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('fanta'); 
  
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetails, setTeamDetails] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await getLeaderboards();
      setData(res);
      setLoading(false);
    };
    load();
  }, []);

  const handleTeamClick = async (user) => {
    if (view !== 'fanta' || !user.mySquad || user.mySquad.length === 0) return;
    setSelectedTeam(user);
    setLoadingTeam(true);
    setTeamDetails([]);
    try {
      const details = await getFullSquadDetails(user.mySquad);
      setTeamDetails(details);
    } catch (e) { console.error(e); } 
    finally { setLoadingTeam(false); }
  };

  const List = ({ items, isFanta }) => (
    <div className="space-y-3">
      {items.map((item, index) => {
        let medalColor = 'bg-white border-gray-200';
        let rankIcon = <span className="font-black text-xl text-gray-400 italic w-8 text-center">#{index + 1}</span>;
        
        if (index === 0) { medalColor = 'bg-yellow-50 border-yellow-300'; rankIcon = <Trophy className="text-yellow-500 w-8" />; }
        if (index === 1) { medalColor = 'bg-slate-50 border-slate-300'; rankIcon = <span className="font-black text-xl text-slate-400 w-8 text-center">2</span>; }
        if (index === 2) { medalColor = 'bg-orange-50 border-orange-200'; rankIcon = <span className="font-black text-xl text-orange-400 w-8 text-center">3</span>; }

        const title = isFanta ? (item.teamName || item.displayName) : item.displayName;
        const subTitle = isFanta ? item.displayName : 'Matricola';
        const isClickable = isFanta && item.mySquad && item.mySquad.length > 0;

        return (
          <div 
            key={item.id} 
            onClick={() => isClickable && handleTeamClick(item)}
            className={`flex items-center p-3 rounded-2xl border-2 shadow-sm transition-all ${medalColor} ${isClickable ? 'cursor-pointer hover:scale-[1.02] active:scale-95' : ''}`}
          >
            {rankIcon}
            <img src={item.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full object-cover mx-3 border border-gray-100" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate text-lg leading-tight">{title}</h3>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                {isFanta && item.teamName && <User size={10} />} {subTitle}
                {isClickable && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 rounded ml-2">Vedi Rosa</span>}
              </p>
            </div>
            <div className="text-right pl-2">
              <span className="block text-2xl font-black text-gray-800 leading-none">{isFanta ? item.fantaPunti : item.punti}</span>
              <span className="text-[9px] uppercase font-bold text-gray-400">Pt</span>
            </div>
          </div>
        );
      })}
      {items.length === 0 && <p className="text-center text-gray-500 py-8">Nessun dato.</p>}
    </div>
  );

  if (loading) return <div className="text-center py-12">Caricamento...</div>;

  return (
    <div>
      <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
        <button onClick={() => setView('fanta')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'fanta' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><Shield size={16} /> Squadre</button>
        <button onClick={() => setView('matricole')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'matricole' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><Users size={16} /> Matricole</button>
      </div>

      <List items={view === 'matricole' ? data.matricole : data.fantallenatori} isFanta={view === 'fanta'} />

      {selectedTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setSelectedTeam(null)}>
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">{selectedTeam.teamName || "Squadra"}</h3>
                        <p className="text-sm text-gray-500">Allenatore: {selectedTeam.displayName}</p>
                    </div>
                    <button onClick={() => setSelectedTeam(null)} className="p-1 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </div>
                {loadingTeam ? (
                    <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
                ) : (
                    <div className="space-y-3">
                        {teamDetails.map(player => {
                             const isCaptain = selectedTeam.captainId === player.id;
                             return (
                                <div key={player.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isCaptain ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
                                    <div className="relative">
                                        <img src={player.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full border border-white shadow-sm" />
                                        {isCaptain && <div className="absolute -top-2 -right-1 bg-yellow-400 text-white p-0.5 rounded-full shadow"><Crown size={10} fill="white"/></div>}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-gray-900">{player.displayName}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Punti: <b>{player.punti || 0}</b></span>
                                            {isCaptain && <span className="text-[9px] bg-yellow-200 text-yellow-800 px-1 rounded font-bold">x2 CAPITANO</span>}
                                        </div>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}
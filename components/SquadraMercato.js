'use client';

import { useState, useEffect } from 'react';
import { recruitMatricola, releaseMatricola, setSquadCaptain, getMarketStatus, toggleMarketStatus } from '@/lib/firebase';
import { UserPlus, Users, Crown, Trash2, Lock, Unlock, Trophy, Star } from 'lucide-react';

export default function SquadraMercato({ currentUser, onUpdate, preloadedUsers = [], t }) {
  const tr = (text) => (t ? t(text) : text);
  const [matricole, setMatricole] = useState([]);
  const [mySquadDetails, setMySquadDetails] = useState([]);
  const [marketOpen, setMarketOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = currentUser.role === 'super-admin';
  const currentSquadSize = currentUser.mySquad ? currentUser.mySquad.length : 0;
  const isSquadFull = currentSquadSize >= 3;

  useEffect(() => { loadMarketData(); }, []);

  useEffect(() => {
    if (preloadedUsers.length > 0) {
      setMatricole(preloadedUsers.filter(u => u.role === 'matricola'));
      if (currentUser.mySquad?.length > 0) {
        setMySquadDetails(preloadedUsers.filter(u => currentUser.mySquad.includes(u.id)));
      } else {
        setMySquadDetails([]);
      }
    }
  }, [currentUser, preloadedUsers]);

  const loadMarketData = async () => {
    setLoading(true);
    setMarketOpen(await getMarketStatus());
    setLoading(false);
  };

  const checkMarket = () => {
    if (!marketOpen && !isSuperAdmin) { alert("Il mercato è CHIUSO!"); return false; }
    return true;
  };

  const handleSetCaptain = async (mid) => {
    if (!checkMarket()) return;
    try { await setSquadCaptain(currentUser.id, mid); onUpdate(); } catch (e) { alert(e); }
  };

  const handleRelease = async (mid) => {
    if (!checkMarket()) return;
    try { await releaseMatricola(currentUser.id, mid); onUpdate(); } catch (e) { alert(e); }
  };

  const handleRecruit = async (m) => {
    if (!checkMarket()) return;
    if (isSquadFull) { alert("Squadra piena (max 3)."); return; }
    try { await recruitMatricola(currentUser.id, m.id); onUpdate(); } catch (e) { alert(e); }
  };

  const toggleStatus = async () => {
    if (!isSuperAdmin) return;
    if (confirm(`Vuoi ${marketOpen ? 'CHIUDERE' : 'APRIRE'} il mercato?`)) {
      await toggleMarketStatus(!marketOpen);
      setMarketOpen(!marketOpen);
    }
  };

  // ── Identica a Classifiche.jsx: puntiBase + puntiSerata solo per il capitano ──
  const calcFantaPunti = (allenatore, users) => {
  let tot = 0;
  if (allenatore.mySquad) {
    allenatore.mySquad.forEach(mid => {
      const matr = users.find(u => u.id === mid);
      if (matr) {
        const isCaptain = allenatore.captainId === mid;
        tot += (matr.punti || 0) + (isCaptain ? (matr.puntiSerata || 0) : 0);
      }
    });
  }
  return tot;
};

  const getRanking = () =>
  preloadedUsers
    .filter(u => u.role !== 'matricola')   // <-- UGUALE a Classifiche.jsx, nessun altro filtro
    .map(u => ({ id: u.id, name: u.displayName ,team: u.teamName, score: calcFantaPunti(u, preloadedUsers) }))
    .sort((a, b) => b.score - a.score);

  const myScore = calcFantaPunti(currentUser, preloadedUsers);
  const ranking = getRanking();
  const myRank = ranking.findIndex(r => r.id === currentUser.id) + 1;
  const totalTeams = ranking.length;

  const filtered = matricole.filter(m => {
    const matchesName = m.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesName && !currentUser.mySquad?.includes(m.id);
  });

  if (loading && matricole.length === 0) return <div className="text-center py-12">Caricamento mercato...</div>;

  // ── VISTA MERCATO CHIUSO (non super-admin) ──────────────────────────────────
  if (!marketOpen ) {
    const medals = ['🥇', '🥈', '🥉'];
    const prev = myRank > 1 ? ranking[myRank - 2] : null;
    const next = myRank < totalTeams ? ranking[myRank] : null;

    return (
      <div className="space-y-6">

        {/* Banner chiuso */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <Lock size={22} className="text-red-500 shrink-0" />
          <div>
            <p className="font-bold text-red-700 text-sm">Mercato chiuso</p>
            <p className="text-xs text-red-500">Non puoi più scegliere le tue matricole.</p>
          </div>
           {isSuperAdmin && (
            <button
              onClick={toggleStatus}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-green-100 text-green-700 shrink-0 whitespace-nowrap"
            >
              <Unlock size={12} /> Riapri
            </button>
          )}
        </div>
   
        {/* La tua squadra – sola lettura */}
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b pb-2">
            <Users className="text-[#B41F35]" /> {tr("La Tua Squadra")}
          </h2>
          {mySquadDetails.length > 0 ? (
  <div className="space-y-3">
    {[...mySquadDetails].sort((a, b) => {
      const aCap = currentUser.captainId === a.id ? -1 : 1;
      const bCap = currentUser.captainId === b.id ? -1 : 1;
      return aCap - bCap;
    }).map((player) => {
      const isCaptain = currentUser.captainId === player.id;
      const pts = player.punti || 0;
      const serata = player.puntiSerata || 0;
      return (
        <div key={player.id} className={`flex items-center justify-between p-4 rounded-xl border ${isCaptain ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <img src={player.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full border-2 border-white shadow" />
            <div>
              <p className="font-bold text-sm flex items-center gap-1">
                {player.displayName}
                {isCaptain && <Crown size={14} className="text-yellow-500" />}
              </p>
              {isCaptain ? (
                <p className="text-xs text-yellow-600 font-semibold">
                  {pts} pt{serata !== 0 && <span> +{serata} serata</span>}
                </p>
              ) : (
                <p className="text-xs text-gray-500">{pts} pt</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className={`text-lg font-black ${isCaptain ? 'text-yellow-600' : 'text-[#B41F35]'}`}>
              {isCaptain ? pts + serata : pts}
            </span>
            <p className="text-[10px] text-gray-400">punti</p>
          </div>
        </div>
      );
    })}
  </div>
) : (
  <div className="text-center py-6 text-gray-400 text-sm">Squadra vuota.</div>
)}
 
        </div>

        {/* Posizione in classifica – solo la propria card + vicini */}
        {myRank > 0 && (
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b pb-2">
              <Trophy className="text-[#B41F35]" /> {tr("Posizione in Classifica")}
            </h2>
            <div className="space-y-2">

              {/* Squadra sopra (ghost) */}
                {prev && (
                <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-gray-100 bg-gray-50 opacity-50">
                    <div className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{medals[myRank - 2] || `#${myRank - 1}`}</span>
                    <img
                        src={preloadedUsers.find(u => u.id === prev.id)?.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${prev.id}&backgroundColor=fecaca`}
                        className="w-8 h-8 rounded-full object-cover border border-white shadow-sm bg-red-50"
                    />
                    <span className="text-sm text-gray-500 truncate">{prev.team ? prev.team : prev.name}</span>
                    </div>
                    <span className="font-bold text-sm text-gray-400">{prev.score} pt</span>
                </div>
                )}

                {/* La mia squadra */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-[#B41F35] bg-red-50 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-xl w-6 text-center">{medals[myRank - 1] || `#${myRank}`}</span>
                    <img
                    src={currentUser.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${currentUser.id}&backgroundColor=fecaca`}
                    className="w-8 h-8 rounded-full object-cover border-2 border-[#B41F35] shadow-sm bg-red-50"
                    />
                    <div>
                    <span className="font-bold text-sm text-[#B41F35]">{currentUser.teamName}</span>
                    <p className="text-[10px] text-[#B41F35]/60 font-semibold">{myRank}° su {totalTeams} squadre</p>
                    </div>
                </div>
                <span className="font-black text-lg text-[#B41F35]">{myScore} pt</span>
                </div>

                {/* Squadra sotto (ghost) */}
                {next && (
                <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-gray-100 bg-gray-50 opacity-50">
                    <div className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{medals[myRank] || `#${myRank + 1}`}</span>
                    <img
                        src={preloadedUsers.find(u => u.id === next.id)?.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${next.id}&backgroundColor=fecaca`}
                        className="w-8 h-8 rounded-full object-cover border border-white shadow-sm bg-red-50"
                    />
                    <span className="text-sm text-gray-500 truncate">{prev.team ? prev.team : prev.name}</span>
                    </div>
                    <span className="font-bold text-sm text-gray-400">{next.score} pt</span>
                </div>
                )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VISTA NORMALE (mercato aperto, o super-admin) ───────────────────────────
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="text-[#B41F35]" /> {tr("La Tua Squadra")} ({currentSquadSize}/3)
          </h2>
          {isSuperAdmin ? (
            <button onClick={toggleStatus} className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${marketOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {marketOpen ? <Unlock size={12} /> : <Lock size={12} />}
              {marketOpen ? 'APERTO' : 'CHIUSO'}
            </button>
          ) : (
            !marketOpen && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Lock size={12} /> CHIUSO</span>
          )}
        </div>

        {mySquadDetails.length > 0 ? (
          <div className="space-y-3">
            {mySquadDetails.sort((a, b) => {
  const aCap = currentUser.captainId === a.id ? -1 : 1;
  const bCap = currentUser.captainId === b.id ? -1 : 1;
  return aCap - bCap;
}).map((player) => {
              const isCaptain = currentUser.captainId === player.id;
              return (
                <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border ${isCaptain ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <img src={player.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-bold text-sm">{player.displayName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        Punti: {player.punti || 0}
                        {isCaptain && (
                          <span className="text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-300 px-1 rounded font-bold">
                            +{player.puntiSerata || 0} serata
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isCaptain && (
                      <button onClick={() => handleSetCaptain(player.id)} disabled={!marketOpen && !isSuperAdmin}
                        className={`p-1.5 rounded-lg border ${(!marketOpen && !isSuperAdmin) ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-400 hover:text-yellow-500'}`}>
                        <Crown size={16} />
                      </button>
                    )}
                    <button onClick={() => handleRelease(player.id)} disabled={!marketOpen && !isSuperAdmin}
                      className={`p-1.5 rounded-lg border ${(!marketOpen && !isSuperAdmin) ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-400 hover:text-red-500'}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="text-center py-6 text-gray-400 text-sm">Squadra vuota.</div>}
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <UserPlus className="text-[#B41F35]" /> {tr("Lista Matricole")}
        </h3>
        <input type="text" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mb-4 p-2 border rounded-xl text-sm" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-white border rounded-xl p-3 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <img src={m.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full" />
                <p className="font-bold text-sm">{m.displayName}</p>
              </div>
              <button onClick={() => handleRecruit(m)} disabled={isSquadFull || (!marketOpen && !isSuperAdmin)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isSquadFull || (!marketOpen && !isSuperAdmin) ? 'bg-gray-100 text-gray-400' : 'bg-[#B41F35] text-white'}`}>
                <UserPlus size={14} />
              </button>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-center text-gray-400 text-sm py-4">Nessuna matricola trovata.</p>}
        </div>
      </div>
    </div>
  );
}
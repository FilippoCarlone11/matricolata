'use client';

import { useState, useEffect } from 'react';
// RIMOSSO getAvailableMatricole e getFullSquadDetails
import { recruitMatricola, releaseMatricola, setSquadCaptain, getMarketStatus, toggleMarketStatus } from '@/lib/firebase';
import { UserPlus, Search, Users, Crown, Trash2, Lock, Unlock } from 'lucide-react';

// AGGIUNTO PROP: preloadedUsers
export default function SquadraMercato({ currentUser, onUpdate, preloadedUsers = [], t }) {
    const tr = (text) => (t ? t(text) : text);
  const [matricole, setMatricole] = useState([]);
  const [mySquadDetails, setMySquadDetails] = useState([]);
  const [marketOpen, setMarketOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // DEFINIZIONE RUOLI
  const isSuperAdmin = currentUser.role === 'super-admin';
  const isAdmin = currentUser.role === 'admin' || isSuperAdmin; 
  
  const currentSquadSize = currentUser.mySquad ? currentUser.mySquad.length : 0;
  const isSquadFull = currentSquadSize >= 3;

  useEffect(() => {
     loadMarketData();
  }, []);

  // Questo effetto aggiorna le liste ISTANTANEAMENTE quando cambia currentUser o preloadedUsers
  // Senza fare chiamate al database!
  useEffect(() => {
     if (preloadedUsers.length > 0) {
        // 1. Calcola lista matricole disponibili (filtro locale)
        const allMatricole = preloadedUsers.filter(u => u.role === 'matricola');
        setMatricole(allMatricole);

        // 2. Calcola dettagli della mia squadra (filtro locale)
        if (currentUser.mySquad && currentUser.mySquad.length > 0) {
            const squad = preloadedUsers.filter(u => currentUser.mySquad.includes(u.id));
            setMySquadDetails(squad);
        } else {
            setMySquadDetails([]);
        }
     }
  }, [currentUser, preloadedUsers]);

  const loadMarketData = async () => {
    setLoading(true);
    // Unica chiamata DB rimasta: controlliamo se il mercato è aperto
    const status = await getMarketStatus();
    setMarketOpen(status);
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

  const handleRelease = async (mid, name) => {
    if (!checkMarket()) return;
    try { 
      await releaseMatricola(currentUser.id, mid); 
      // L'aggiornamento visivo avverrà quando onUpdate ricaricherà currentUser
      onUpdate(); 
    } catch (e) { alert(e); }
  };

  const handleRecruit = async (m) => {
    if (!checkMarket()) return;
    if (isSquadFull) { alert("Squadra piena (max 3)."); return; }
    try {
      await recruitMatricola(currentUser.id, m.id);
      // L'aggiornamento visivo avverrà quando onUpdate ricaricherà currentUser
      onUpdate();
    } catch (e) { alert(e); }
  };

  const toggleStatus = async () => {
    if (!isSuperAdmin) return;
    if (confirm(`Vuoi ${marketOpen ? 'CHIUDERE' : 'APRIRE'} il mercato?`)) {
      await toggleMarketStatus(!marketOpen);
      setMarketOpen(!marketOpen);
    }
  };

  const filtered = matricole.filter(m => {
    const matchesName = m.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const alreadyOwn = currentUser.mySquad && currentUser.mySquad.includes(m.id);
    return matchesName && !alreadyOwn;
  });

  if (loading && matricole.length === 0) return <div className="text-center py-12">Caricamento mercato...</div>;

  return (
    <div className="space-y-8">
      
      {/* HEADER ROSA */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-[#B41F35]"/> {tr("La Tua Squadra")} ({currentSquadSize}/3)</h2>
            
            {/* SOLO SUPER ADMIN APRE/CHIUDE */}
            {isSuperAdmin ? (
                <button onClick={toggleStatus} className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${marketOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {marketOpen ? <Unlock size={12}/> : <Lock size={12}/>} {marketOpen ? 'APERTO' : 'CHIUSO'}
                </button>
            ) : (
                !marketOpen && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Lock size={12}/> CHIUSO</span>
            )}
        </div>

        {/* LISTA ROSA */}
        {mySquadDetails.length > 0 ? (
            <div className="space-y-3">
            {mySquadDetails.map((player) => {
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
                                    x2 = {(player.punti || 0) * 2}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    {/* BOTTONI CONDIZIONALI */}
                    <div className="flex gap-2">
                        {!isCaptain && (
                            <button onClick={() => handleSetCaptain(player.id)} disabled={!marketOpen && !isSuperAdmin} className={`p-1.5 rounded-lg border ${(!marketOpen && !isSuperAdmin) ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-400 hover:text-yellow-500'}`}>
                                <Crown size={16} />
                            </button>
                        )}
                        <button onClick={() => handleRelease(player.id, player.displayName)} disabled={!marketOpen && !isSuperAdmin} className={`p-1.5 rounded-lg border ${(!marketOpen && !isSuperAdmin) ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-400 hover:text-red-500'}`}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                );
            })}
            </div>
        ) : <div className="text-center py-6 text-gray-400 text-sm">Squadra vuota.</div>}
      </div>

{/* LISTA SVINCOLATI */}
      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><UserPlus className="text-[#B41F35]"/> {tr("Lista Matricole")}</h3>
        <input type="text" placeholder="Cerca..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full mb-4 p-2 border rounded-xl text-sm" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(m => (
            <div key={m.id} className="bg-white border rounded-xl p-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={m.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="font-bold text-sm">{m.displayName}  </p>
                    </div>
                </div>
                <button 
                    onClick={() => handleRecruit(m)} 
                    disabled={isSquadFull || (!marketOpen && !isSuperAdmin)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isSquadFull || (!marketOpen && !isSuperAdmin) ? 'bg-gray-100 text-gray-400' : 'bg-[#B41F35] text-white'}`}
                >
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
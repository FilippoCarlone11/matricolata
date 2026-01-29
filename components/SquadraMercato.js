'use client';

import { useState, useEffect } from 'react';
import { getAvailableMatricole, recruitMatricola, getFullSquadDetails, releaseMatricola, setSquadCaptain, getMarketStatus, toggleMarketStatus } from '@/lib/firebase';
import { UserPlus, Search, Users, Crown, Trash2, Lock, Unlock } from 'lucide-react';

export default function SquadraMercato({ currentUser, onUpdate }) {
  const [matricole, setMatricole] = useState([]);
  const [mySquadDetails, setMySquadDetails] = useState([]);
  const [marketOpen, setMarketOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = currentUser.role === 'admin';
  const currentSquadSize = currentUser.mySquad ? currentUser.mySquad.length : 0;
  const isSquadFull = currentSquadSize >= 3;

  useEffect(() => { loadAllData(); }, [currentUser]);

  const loadAllData = async () => {
    setLoading(true);
    const [avail, status] = await Promise.all([ getAvailableMatricole(), getMarketStatus() ]);
    setMatricole(avail);
    setMarketOpen(status);
    if (currentUser.mySquad?.length > 0) setMySquadDetails(await getFullSquadDetails(currentUser.mySquad));
    else setMySquadDetails([]);
    setLoading(false);
  };

// Funzione helper per gestire il blocco
  const checkMarket = () => {
    // Se il mercato è chiuso E NON SONO ADMIN, blocco tutto.
    if (!marketOpen && !isAdmin) { 
        alert("Il mercato è CHIUSO! Non puoi fare modifiche alla formazione."); 
        return false; 
    }
    return true;
  };

  const handleSetCaptain = async (mid) => {
    // CONTROLLO BLOCCO MERCATO QUI
    if (!checkMarket()) return;
    
    try { await setSquadCaptain(currentUser.id, mid); onUpdate(); } catch (e) { alert(e); }
  };



  const handleRelease = async (mid, name) => {
    if (!checkMarket()) return;
    if (!confirm(`Svincolare ${name}?`)) return;
    try { 
      await releaseMatricola(currentUser.id, mid); 
      // Aggiornamento locale rapido
      setMySquadDetails(prev => prev.filter(p => p.id !== mid));
      onUpdate(); 
      loadAllData(); // Ricarica matricole per farla riapparire sotto
    } catch (e) { alert(e); }
  };

  const handleRecruit = async (m) => {
    if (!checkMarket()) return;
    if (isSquadFull) { alert("Rosa piena (max 3)."); return; }
    if (!confirm(`Ingaggiare ${m.displayName}?`)) return;
    try {
      await recruitMatricola(currentUser.id, m.id);
      // Rimuoviamo visivamente dalla lista sotto e aggiungiamo sopra
      setMatricole(prev => prev.filter(x => x.id !== m.id));
      setMySquadDetails(prev => [...prev, m]);
      onUpdate();
    } catch (e) { alert(e); }
  };

  const toggleStatus = async () => {
    if (confirm(`Vuoi ${marketOpen ? 'CHIUDERE' : 'APRIRE'} il mercato?`)) {
      await toggleMarketStatus(!marketOpen);
      setMarketOpen(!marketOpen);
    }
  };

  // --- FILTRO AVANZATO ---
  // 1. Cerca per nome
  // 2. NASCONDI quelli che ho già in squadra (currentUser.mySquad contiene gli ID)
  const filtered = matricole.filter(m => {
    const matchesName = m.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const alreadyOwn = currentUser.mySquad && currentUser.mySquad.includes(m.id);
    return matchesName && !alreadyOwn;
  });

  if (loading) return <div className="text-center py-12">Caricamento...</div>;

  return (
    <div className="space-y-8">
      
      {/* HEADER ROSA */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-blue-600"/> La tua squadra ({currentSquadSize}/3)</h2>
            {isAdmin ? (
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
                            <button onClick={() => handleSetCaptain(player.id)} disabled={!marketOpen && !isAdmin} className={`p-1.5 rounded-lg border ${(!marketOpen && !isAdmin) ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-400 hover:text-yellow-500'}`}>
                                <Crown size={16} />
                            </button>
                        )}
                        <button onClick={() => handleRelease(player.id, player.displayName)} disabled={!marketOpen && !isAdmin} className={`p-1.5 rounded-lg border ${(!marketOpen && !isAdmin) ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-400 hover:text-red-500'}`}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                );
            })}
            </div>
        ) : <div className="text-center py-6 text-gray-400 text-sm">Rosa vuota.</div>}
      </div>

      {/* LISTA SVINCOLATI */}
      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><UserPlus className="text-green-600"/> Lista Matricole</h3>
        <input type="text" placeholder="Cerca..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full mb-4 p-2 border rounded-xl text-sm" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(m => (
            <div key={m.id} className="bg-white border rounded-xl p-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={m.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full" />
                    <div><p className="font-bold text-sm">{m.displayName}</p><span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded">Pt: {m.punti||0}</span></div>
                </div>
                <button 
                    onClick={() => handleRecruit(m)} 
                    disabled={isSquadFull || (!marketOpen && !isAdmin)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${isSquadFull || (!marketOpen && !isAdmin) ? 'bg-gray-100 text-gray-400' : 'bg-green-600 text-white'}`}
                >
                    <UserPlus size={14} /> Prendi
                </button>
            </div>
            ))}
            {filtered.length === 0 && <p className="col-span-full text-center text-gray-400 text-sm py-4">Nessuna matricola trovata (o le hai già tutte in squadra!).</p>}
        </div>
      </div>
    </div>
  );
}
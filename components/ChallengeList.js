'use client';

import { useState, useEffect } from 'react';
import { getChallenges, createRequest, getUserRequests } from '@/lib/firebase';
import { Send, Plus, Zap, Search, Clock, Hourglass } from 'lucide-react';

export default function ChallengeList({ currentUser }) {
  const [challenges, setChallenges] = useState([]); // Tutte le sfide caricate
  const [myRequests, setMyRequests] = useState([]); // Tutte le mie richieste
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  
  // Stato per la ricerca
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { loadData(); }, [currentUser]);

  const loadData = async () => {
    const [challs, reqs] = await Promise.all([ getChallenges(), getUserRequests(currentUser.id) ]);
    // Carichiamo tutto, filtreremo nel render
    setChallenges(challs);
    setMyRequests(reqs);
    setLoading(false);
  };

  const handleSendRequest = async (challenge) => {
    if (!confirm(`Richiedere approvazione per: "${challenge.titolo}"?`)) return;
    setSending(challenge.id);
    try {
      await createRequest(currentUser.id, challenge.id, challenge.punti);
      const newReqs = await getUserRequests(currentUser.id);
      setMyRequests(newReqs);
      setSearchTerm(''); // Pulisce ricerca dopo invio
    } catch (e) { alert("Errore: " + e); } 
    finally { setSending(null); }
  };

  // LOGICA DI FILTRO (Cosa posso richiedere?)
  const isRequestable = (challengeId, challengeType) => {
    const reqs = myRequests.filter(r => r.challengeId === challengeId);
    
    // 1. Se APPROVATA
    const approved = reqs.find(r => r.status === 'approved');
    if (approved) {
        if (challengeType === 'daily') {
            const today = new Date().toDateString();
            const reqDate = approved.approvedAt?.toDate().toDateString();
            if (reqDate === today) return false; // Fatta oggi
        } else {
            return false; // One-shot fatta
        }
    }
    // 2. Se PENDING -> Non mostrare nella lista "Richiedibili", la mostriamo sotto
    const pending = reqs.find(r => r.status === 'pending');
    if (pending) return false;

    return true;
  };

  // 1. Filtra solo BONUS, VISIBILI e RICHIEDIBILI
  const activeChallenges = challenges.filter(c => 
    c.punti > 0 && 
    !c.hidden && 
    isRequestable(c.id, c.type)
  );

  // 2. Filtra in base alla RICERCA utente
  const filteredList = activeChallenges.filter(c => 
    c.titolo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. Estrai le PENDING per mostrarle in fondo
  const pendingRequests = myRequests
    .filter(r => r.status === 'pending')
    .map(req => {
        // Cerchiamo il titolo della sfida usando l'ID
        const originalChallenge = challenges.find(c => c.id === req.challengeId);
        return { 
            ...req, 
            titolo: originalChallenge ? originalChallenge.titolo : 'Bonus Sconosciuto',
            punti: originalChallenge ? originalChallenge.punti : '?'
        };
    });

  if (loading) return <div className="text-center py-8">Caricamento...</div>;

  return (
    <div className="space-y-8 mb-8">
      
      {/* SEZIONE 1: RICERCA E BONUS DISPONIBILI */}
      <div>
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Zap size={24} className="text-yellow-500 fill-yellow-500" /> Richiedi Bonus
            </h2>
        </div>

        {/* Barra di Ricerca */}
        <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
                type="text" 
                placeholder="Cerca bonus..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-yellow-400 outline-none"
            />
        </div>
        
        {filteredList.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-500">{searchTerm ? 'Nessun bonus trovato con questo nome.' : 'Nessun bonus disponibile al momento.'}</p>
            </div>
        ) : (
            <div className="space-y-3">
            {filteredList.map(c => (
                <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.icon}</span>
                    <div>
                    <h3 className="font-bold text-gray-900 leading-tight">{c.titolo}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 bg-green-100 text-green-700">
                            <Plus size={10}/> {c.punti} pt
                        </span>
                        {c.type === 'daily' && <span className="text-[10px] text-purple-600 bg-purple-50 px-1 rounded font-bold border border-purple-100">GIORNALIERO</span>}
                    </div>
                    </div>
                </div>

                <button
                    onClick={() => handleSendRequest(c)}
                    disabled={sending === c.id}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow-md rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                >
                    {sending === c.id ? '...' : <><Send size={16}/> Richiedi</>}
                </button>
                </div>
            ))}
            </div>
        )}
      </div>

      {/* SEZIONE 2: IN ATTESA (PENDING) */}
      {pendingRequests.length > 0 && (
        <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Hourglass size={16}/> In Attesa di Approvazione
            </h3>
            <div className="space-y-2">
                {pendingRequests.map(req => (
                    <div key={req.id} className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex items-center justify-between opacity-80">
                        <div className="flex items-center gap-3">
                            <Clock size={20} className="text-yellow-600"/>
                            <div>
                                <p className="font-bold text-sm text-gray-800">{req.titolo}</p>
                                <p className="text-xs text-yellow-700">Richiesta inviata</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold bg-white text-yellow-700 px-2 py-1 rounded border border-yellow-100">
                            +{req.punti} pt
                        </span>
                    </div>
                ))}
            </div>
        </div>
      )}

    </div>
  );
}
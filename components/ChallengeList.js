'use client';

import { useState, useEffect } from 'react';
import { getChallenges, createRequest, getUserRequests } from '@/lib/firebase';
import { CheckCircle, Clock, XCircle, Send, Plus, Minus } from 'lucide-react';

export default function ChallengeList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);

  useEffect(() => { loadData(); }, [currentUser]);

  const loadData = async () => {
    const [challs, reqs] = await Promise.all([ getChallenges(), getUserRequests(currentUser.id) ]);
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
    } catch (e) { alert("Errore: " + e); } 
    finally { setSending(null); }
  };

  // Funzione per capire lo stato
  const getStatus = (challengeId, challengeType) => {
    const reqs = myRequests.filter(r => r.challengeId === challengeId);
    
    // 1. Approvata?
    const approved = reqs.find(r => r.status === 'approved');
    if (approved) {
        if (challengeType === 'daily') {
            // FIX: Se è daily, controllo se è stata fatta OGGI
            const today = new Date().toDateString();
            const reqDate = approved.approvedAt?.toDate().toDateString();
            if (reqDate === today) return 'done_today';
            // Se la data è vecchia, return 'new' (implicito, perché non matcha 'done_today')
        } else {
            return 'done'; // One-shot fatta per sempre
        }
    }

    // 2. In attesa?
    const pending = reqs.find(r => r.status === 'pending');
    if (pending) return 'pending';

    // 3. Rifiutata? (Se l'ultima è rifiutata e non ce ne sono altre pending)
    const rejected = reqs.find(r => r.status === 'rejected');
    if (rejected) return 'rejected'; // FIX: Permette di riprovare

    return 'new';
  };

  if (loading) return <div className="text-center py-8">Caricamento...</div>;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        🎯 Bonus & Malus Disponibili
      </h2>
      
      <div className="space-y-3">
        {challenges.map(c => {
          const status = getStatus(c.id, c.type);
          const isMalus = c.punti < 0;

          let btnContent, btnClass, isDisabled;
          switch(status) {
            case 'done':
            case 'done_today':
                btnContent = <><CheckCircle size={18}/> Fatto</>;
                btnClass = "bg-green-100 text-green-700 border-green-200";
                isDisabled = true;
                break;
            case 'pending':
                btnContent = <><Clock size={18}/> In attesa</>;
                btnClass = "bg-yellow-100 text-yellow-700 border-yellow-200";
                isDisabled = true;
                break;
            case 'rejected':
                btnContent = <><XCircle size={18}/> Riprova</>;
                btnClass = "bg-red-100 text-red-700 border-red-200 hover:bg-red-200";
                isDisabled = false; 
                break;
            default: 
                btnContent = <><Send size={18}/> Richiedi</>;
                btnClass = "bg-blue-600 text-white hover:bg-blue-700 shadow-md";
                isDisabled = false;
          }

          return (
            <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <h3 className={`font-bold leading-tight ${isMalus ? 'text-red-900' : 'text-gray-900'}`}>
                    {c.titolo}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isMalus ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isMalus ? <Minus size={10}/> : <Plus size={10}/>} {Math.abs(c.punti)} pt
                    </span>
                    {c.type === 'daily' && <span className="text-[10px] text-purple-600 bg-purple-50 px-1 rounded font-bold border border-purple-100">DAILY</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={() => !isDisabled && handleSendRequest(c)}
                disabled={isDisabled || sending === c.id}
                className={`px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 transition-all ${btnClass} ${isDisabled ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                {sending === c.id ? '...' : btnContent}
              </button>
            </div>
          );
        })}
        {challenges.length === 0 && <p className="text-gray-400 text-center py-4">Nessun bonus/malus attivo.</p>}
      </div>
    </div>
  );
}
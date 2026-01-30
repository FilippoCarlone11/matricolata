'use client';

import { useState, useEffect } from 'react';
import { getChallenges, createRequest, getUserRequests } from '@/lib/firebase';
import { Send, Plus, Zap } from 'lucide-react';

export default function ChallengeList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);

  useEffect(() => { loadData(); }, [currentUser]);

  const loadData = async () => {
    const [challs, reqs] = await Promise.all([ getChallenges(), getUserRequests(currentUser.id) ]);
    // FILTRO FONDAMENTALE: 
    // 1. Solo Punti > 0 (Bonus)
    // 2. Solo NON Nascosti (!hidden)
    const activeBonuses = challs.filter(c => c.punti > 0 && !c.hidden);
    
    setChallenges(activeBonuses);
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

  const isRequestable = (challengeId, challengeType) => {
    const reqs = myRequests.filter(r => r.challengeId === challengeId);
    
    const approved = reqs.find(r => r.status === 'approved');
    if (approved) {
        if (challengeType === 'daily') {
            const today = new Date().toDateString();
            const reqDate = approved.approvedAt?.toDate().toDateString();
            if (reqDate === today) return false; 
        } else {
            return false; 
        }
    }

    const pending = reqs.find(r => r.status === 'pending');
    if (pending) return false;

    return true;
  };

  const activeChallenges = challenges.filter(c => isRequestable(c.id, c.type));

  if (loading) return <div className="text-center py-8">Caricamento...</div>;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Zap size={24} className="text-yellow-500 fill-yellow-500" /> Bonus Disponibili
      </h2>
      
      {activeChallenges.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500">Nessun bonus richiedibile al momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeChallenges.map(c => (
            <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">{c.titolo}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 bg-green-100 text-green-700">
                        <Plus size={10}/> {c.punti} pt
                    </span>
                    {c.type === 'daily' && <span className="text-[10px] text-purple-600 bg-purple-50 px-1 rounded font-bold border border-purple-100">DAILY</span>}
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
  );
}
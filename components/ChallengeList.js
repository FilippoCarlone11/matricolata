'use client';

import { useState, useEffect } from 'react';
import { createRequest, getUserRequests } from '@/lib/firebase'; 
import { Send, Plus, Zap, Search, Clock, Hourglass, Camera, Loader2, Info, X } from 'lucide-react';

export default function ChallengeList({ currentUser, preloadedChallenges = [], t }) {
  const [challenges, setChallenges] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const tr = (text) => (t ? t(text) : text);
  
  const [sendingId, setSendingId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeCardId, setActiveCardId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [flippedId, setFlippedId] = useState(null);

  useEffect(() => {
    if (preloadedChallenges.length > 0) {
        setChallenges(preloadedChallenges);
    }
    loadUserStatus();
  }, [currentUser, preloadedChallenges]);

  const loadUserStatus = async () => {
    if (!currentUser?.id) return;
    const reqs = await getUserRequests(currentUser.id);
    setMyRequests(reqs);
    setLoading(false);
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
          canvas.height = (img.width > MAX_WIDTH) ? (img.height * scaleSize) : img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSendRequest = async (challenge) => {
    setSendingId(challenge.id);
    try {
      let photoString = null;
      if (selectedFile && activeCardId === challenge.id) {
        photoString = await compressImage(selectedFile);
      }

      await createRequest(
          currentUser.id, 
          challenge.id, 
          challenge.punti, 
          photoString,
          currentUser, 
          challenge    
      );
      
      const newReqs = await getUserRequests(currentUser.id);
      setMyRequests(newReqs);
      
      setSearchTerm(''); 
      setSelectedFile(null);
      setActiveCardId(null);
      setFlippedId(null);
    } catch (e) { alert("Errore: " + e); } 
    finally { setSendingId(null); }
  };

  // --- LOGICA CORRETTA ---
  const isRequestable = (challengeId, challengeType) => {
    // 1. PRIORITÀ ASSOLUTA: Se c'è una richiesta in attesa, NASCONDI SEMPRE
    const pending = myRequests.find(r => r.challengeId === challengeId && r.status === 'pending');
    if (pending) return false;

    // 2. Se non è in attesa, controlliamo lo storico delle approvate
    const approvedReqs = myRequests.filter(r => r.challengeId === challengeId && r.status === 'approved');

    if (approvedReqs.length > 0) {
        if (challengeType === 'daily') {
            const today = new Date().toDateString();
            
            // Controlla se una QUALSIASI delle richieste approvate è stata fatta OGGI
            const doneToday = approvedReqs.some(r => {
                let reqDate = null;
                const timestamp = r.approvedAt || r.createdAt;
                
                if (timestamp?.toDate) {
                    reqDate = timestamp.toDate().toDateString();
                } else if (timestamp) { // Fallback se fosse una data JS standard
                    reqDate = new Date(timestamp).toDateString();
                }
                
                return reqDate === today;
            });

            // Se l'ho fatta oggi -> False (Nascondi). Se l'ho fatta ieri -> True (Mostra)
            return !doneToday; 
        } else {
            // Oneshot: Se ce n'è anche solo una approvata, è andata per sempre
            return false; 
        }
    }
    
    return true;
  };

  const activeChallenges = challenges.filter(c => c.punti > 0 && !c.hidden && isRequestable(c.id, c.type));
  const filteredList = activeChallenges.filter(c => c.titolo.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const pendingRequests = myRequests.filter(r => r.status === 'pending').map(req => {
        const originalChallenge = challenges.find(c => c.id === req.challengeId);
        return { 
            ...req, 
            titolo: originalChallenge ? originalChallenge.titolo : (req.challengeTitle || 'Bonus'), 
            punti: originalChallenge ? originalChallenge.punti : req.puntiRichiesti 
        };
    });

  if (loading && challenges.length === 0) return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></div>;

  return (
    <div className="space-y-8 mb-8">
      <div>
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Zap size={24} className="text-yellow-500 fill-yellow-500" /> {tr("Richiedi Bonus")}
            </h2>
        </div>

        <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input type="text" placeholder="Cerca bonus..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-yellow-400 outline-none" />
        </div>
        
        {filteredList.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 shadow-sm"><p className="text-gray-500">Nessun bonus disponibile.</p></div>
        ) : (
            <div className="space-y-3 perspective-1000">
            {filteredList.map(c => {
                const isSending = sendingId === c.id;
                const hasFile = selectedFile && activeCardId === c.id;
                const isFlipped = flippedId === c.id;

                return (
                <div key={c.id} className="relative group h-full" style={{ perspective: '1000px' }}>
                    <div className={`relative transition-all duration-500 w-full h-full preserve-3d`} 
                         style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                        
                        {/* FRONTE */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 backface-hidden"
                             style={{ backfaceVisibility: 'hidden' }}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{c.icon}</span>
                                    <div>
                                        <h3 className="font-bold text-gray-900 leading-tight">{c.titolo}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 bg-green-100 text-green-700"><Plus size={10}/> {c.punti} pt</span>
                                            {c.type === 'daily' && (
                                                                    <span className="text-[10px] text-[#B41F35] bg-[#B41F35]/10 px-1 rounded font-bold border border-[#B41F35]/20">
                                                                        {tr("GIORNALIERO")}
                                                                    </span>
                                                                    )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setFlippedId(c.id)} className="text-gray-400 hover:text-blue-500 p-1">
                                    <Info size={20} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 border-t pt-3 border-gray-50">
                                <label className={`cursor-pointer p-2 rounded-lg border transition-all flex items-center justify-center ${hasFile ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100'}`}>
                                    <input type="file" accept="image/*" className="hidden" 
                                        onChange={(e) => {
                                            if(e.target.files[0]) { setSelectedFile(e.target.files[0]); setActiveCardId(c.id); }
                                        }}
                                    />
                                    <Camera size={20} />
                                </label>
                                <button 
                                    onClick={() => handleSendRequest(c)} 
                                    disabled={isSending} 
                                    className={`flex-1 px-4 py-2 bg-[#B41F35] hover:bg-[#90192a] text-white shadow-md rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all ${isSending ? 'opacity-70' : ''}`}
                                >
                                    {isSending ? <Loader2 className="animate-spin" size={16}/> : <><Send size={16}/> {tr("Richiedi")} {hasFile && 'con Foto'}</>}
                                </button>
                            </div>
                        </div>

                        {/* RETRO */}
                        <div className="absolute inset-0 bg-white p-4 rounded-xl shadow-md border-2 border-gray-100 flex flex-col justify-between backface-hidden"
                             style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-gray-800">Descrizione</h3>
                                    <button onClick={() => setFlippedId(null)} className="text-gray-400 hover:text-red-500 bg-gray-50 p-1 rounded-full">
                                        <X size={20} />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {c.description || "Nessuna descrizione dettagliata disponibile per questo bonus."}
                                </p>
                            </div>
                            <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100 text-center uppercase tracking-wider font-semibold">
                                Info Bonus
                            </div>
                        </div>

                    </div>
                </div>
                );
            })}
            </div>
        )}
      </div>

      {pendingRequests.length > 0 && (
        <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Hourglass size={16}/> In Attesa di Approvazione</h3>
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
                        <span className="text-xs font-bold bg-white text-yellow-700 px-2 py-1 rounded border border-yellow-100">+{req.punti} pt</span>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}
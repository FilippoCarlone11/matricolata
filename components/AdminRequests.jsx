'use client';

import { useState, useEffect } from 'react';
import { onPendingRequestsChange, approveRequest, rejectRequest } from '@/lib/firebase';
import { Check, X, Clock, Camera } from 'lucide-react';

export default function AdminRequests({t}) {
  const tr = (text) => (t ? t(text) : text);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    const unsubscribe = onPendingRequestsChange((data) => {
      setRequests(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAction = async (req, action) => {
    setProcessing(req.id);
    try {
      if (action === 'approve') {
          // Passiamo matricolaId che ora è garantito dal fix in firebase.js
          await approveRequest(req.id, req.matricolaId, req.puntiRichiesti);
      } else {
          await rejectRequest(req.id);
      }
    } catch (e) { 
        alert("Errore: " + e.message); 
    } finally { 
        setProcessing(null); 
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-gray-500">Caricamento richieste...</div>;

  return (
    <div className="bg-orange-50 rounded-2xl shadow-sm border border-orange-100 p-5 mb-8">
      <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">
        <Clock size={20} /> {tr("Richieste In Attesa")}
        {requests.length > 0 && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">{requests.length}</span>}
      </h3>

      {requests.length === 0 ? (
        <p className="text-sm text-orange-400 italic">{tr("Nessuna richiesta da approvare al momento.")}</p>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white p-3 rounded-xl shadow-sm border border-orange-100 flex flex-col gap-3 animate-in fade-in">
              
              {/* RIGA SUPERIORE: ICONA SFIDA + NOME + PUNTI */}
              <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    {/* QUI MOSTRIAMO L'ICONA DELLA SFIDA INVECE DELLA FOTO PROFILO */}
                    <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-2xl">
                        {req.challengeIcon || '🏆'}
                    </div>
                    
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">{req.challengeName}</p>
                      <p className="text-xs text-gray-500">Richiesto da: <b className="text-gray-700">{req.userName}</b></p>
                    </div>
                  </div>

                  <span className="font-bold bg-green-50 text-green-700 px-2 py-1 rounded text-sm border border-green-100">
                    +{req.puntiRichiesti}
                  </span>
              </div>

              {/* EVENTUALE FOTO PROVA (Se presente) */}
              {req.photoProof && (
                 <div className="bg-gray-100 rounded-lg p-2 border border-gray-200">
                    <p className="text-[10px] text-gray-500 font-bold mb-1 flex items-center gap-1">
                        <Camera size={12}/> PROVA ALLEGATA:
                    </p>
                    <img src={req.photoProof} className="w-full max-h-[300px] object-contain rounded bg-white" />
                 </div>
              )}

              {/* RIGA INFERIORE: BOTTONI */}
              <div className="flex items-center gap-2 w-full justify-end border-t border-gray-50 pt-2">
                <button onClick={() => handleAction(req, 'reject')} disabled={processing === req.id} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                    <X size={18}/>
                </button>
                <button onClick={() => handleAction(req, 'approve')} disabled={processing === req.id} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-bold shadow-sm transition-colors">
                  {processing === req.id ? '...' : <><Check size={18}/> Approva</>}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
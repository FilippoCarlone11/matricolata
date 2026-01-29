'use client';

import { useState, useEffect } from 'react';
import { onPendingRequestsChange, approveRequest, rejectRequest } from '@/lib/firebase';
import { Check, X, Clock, AlertCircle } from 'lucide-react';

export default function AdminRequests() {
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
      if (action === 'approve') await approveRequest(req.id, req.matricolaId, req.puntiRichiesti);
      else await rejectRequest(req.id);
    } catch (e) { alert("Errore: " + e.message); } 
    finally { setProcessing(null); }
  };

  if (loading) return <div className="text-center py-4 text-sm text-gray-500">Caricamento richieste...</div>;

  return (
    <div className="bg-orange-50 rounded-2xl shadow-sm border border-orange-100 p-5 mb-8">
      <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">
        <Clock size={20} /> Richieste In Attesa
        {requests.length > 0 && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">{requests.length}</span>}
      </h3>

      {requests.length === 0 ? (
        <p className="text-sm text-orange-400 italic">Nessuna richiesta da approvare al momento.</p>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white p-3 rounded-xl shadow-sm border border-orange-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-3 w-full">
                <img src={req.userPhoto || '/default-avatar.png'} className="w-10 h-10 rounded-full border border-gray-200" />
                <div>
                  <p className="font-bold text-gray-900 text-sm">{req.userName}</p>
                  <p className="text-xs text-gray-600">Sfida: <b>{req.challengeName}</b></p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full justify-end">
                <span className="font-bold bg-gray-50 px-2 py-1 rounded text-gray-700 text-sm">+{req.puntiRichiesti}</span>
                <button onClick={() => handleAction(req, 'reject')} disabled={processing === req.id} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><X size={18}/></button>
                <button onClick={() => handleAction(req, 'approve')} disabled={processing === req.id} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm font-bold">
                  {processing === req.id ? '...' : <><Check size={18}/> Sì</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
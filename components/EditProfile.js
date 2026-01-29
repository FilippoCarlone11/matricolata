'use client';

import { useState } from 'react';
import { updateUserProfile } from '@/lib/firebase';
import { X, Save, RefreshCw, Link as LinkIcon, Image as ImageIcon, Shield } from 'lucide-react';

export default function EditProfile({ user, onClose, onUpdate }) {
  const [name, setName] = useState(user.displayName || '');
  const [teamName, setTeamName] = useState(user.teamName || ''); // Nuovo stato per Nome Squadra
  const [photoType, setPhotoType] = useState('current'); 
  const [customUrl, setCustomUrl] = useState('');
  const [seed, setSeed] = useState(user.id);
  const [loading, setLoading] = useState(false);

  const getDiceBearUrl = (s) => `https://api.dicebear.com/9.x/notionists/svg?seed=${s}&backgroundColor=e5e7eb`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let finalPhoto = user.photoURL;
    if (photoType === 'dicebear') finalPhoto = getDiceBearUrl(seed);
    else if (photoType === 'url' && customUrl) finalPhoto = customUrl;

    try {
      // Passiamo anche il teamName
      await updateUserProfile(user.id, name, teamName, finalPhoto);
      await onUpdate(); 
      onClose();
    } catch (error) {
      alert("Errore: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isMatricola = user.role === 'matricola';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
        <h2 className="text-xl font-bold text-gray-900 mb-6">Personalizza Profilo</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* CAMPO 1: NOME UTENTE */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Il tuo Nome</label>
            <input 
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              placeholder="Nome e Cognome..." required
            />
          </div>

          {/* CAMPO 2: NOME SQUADRA (Solo per Fantallenatori) */}
          {!isMatricola && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase flex items-center gap-1">
                 <Shield size={12}/> Nome Squadra
              </label>
              <input 
                type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none font-bold text-purple-700"
                placeholder="Es: SSC Napoli..."
              />
              <p className="text-[10px] text-gray-400 mt-1">Questo nome apparirà nelle classifiche.</p>
            </div>
          )}

          {/* CAMPO 3: FOTO */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Foto Profilo</label>
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              <button type="button" onClick={() => setPhotoType('current')} className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap ${photoType === 'current' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}>Attuale</button>
              <button type="button" onClick={() => setPhotoType('dicebear')} className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap ${photoType === 'dicebear' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white'}`}>Cartoon</button>
              <button type="button" onClick={() => setPhotoType('url')} className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap ${photoType === 'url' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white'}`}>Link Web</button>
            </div>

            <div className="flex items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              {photoType === 'current' && <img src={user.photoURL} className="w-16 h-16 rounded-full border-2 border-white shadow" />}
              {photoType === 'dicebear' && (
                <div className="text-center">
                    <img src={getDiceBearUrl(seed)} className="w-16 h-16 rounded-full border-2 border-white shadow bg-white mx-auto" />
                    <button type="button" onClick={() => setSeed(Math.random().toString())} className="mt-2 text-xs text-purple-600 font-bold flex items-center gap-1 mx-auto"><RefreshCw size={10}/> Cambia</button>
                </div>
              )}
              {photoType === 'url' && (
                 <div className="w-full">
                    <input type="url" placeholder="Incolla link https://..." value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} className="w-full p-2 text-xs border rounded mb-2" />
                    {customUrl && <img src={customUrl} onError={(e) => e.target.style.display='none'} className="w-12 h-12 rounded-full mx-auto border shadow" />}
                 </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg">
            {loading ? 'Salvataggio...' : 'Salva Profilo'}
          </button>
        </form>
      </div>
    </div>
  );
}
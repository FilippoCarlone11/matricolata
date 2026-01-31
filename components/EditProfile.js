'use client';

import { useState } from 'react';
import { updateUserProfile } from '@/lib/firebase';
import { X, Save, RefreshCw, Camera, Upload, Shield } from 'lucide-react';

export default function EditProfile({ user, onClose, onUpdate }) {
  const [name, setName] = useState(user.displayName || '');
  const [teamName, setTeamName] = useState(user.teamName || '');
  const [photoType, setPhotoType] = useState('current'); // 'current', 'upload', 'dicebear', 'url'
  const [customUrl, setCustomUrl] = useState('');
  const [uploadedBase64, setUploadedBase64] = useState(null);
  const [seed, setSeed] = useState(user.id);
  const [loading, setLoading] = useState(false);

  const getDiceBearUrl = (s) => `https://api.dicebear.com/9.x/notionists/svg?seed=${s}&backgroundColor=e5e7eb`;

  // --- FUNZIONE COMPRESSIONE ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500; // Avatar piccolo (500px)
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Salvataggio in stato locale
        setUploadedBase64(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let finalPhoto = user.photoURL;
    
    // Logica selezione foto finale
    if (photoType === 'dicebear') finalPhoto = getDiceBearUrl(seed);
    else if (photoType === 'url' && customUrl) finalPhoto = customUrl;
    else if (photoType === 'upload' && uploadedBase64) finalPhoto = uploadedBase64;

    try {
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
            
            {/* Pulsanti Selezione Tipo (Scorrimento orizzontale su mobile) */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
              <button type="button" onClick={() => setPhotoType('current')} className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap ${photoType === 'current' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}>Attuale</button>
              <button type="button" onClick={() => setPhotoType('upload')} className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap flex items-center gap-1 ${photoType === 'upload' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white'}`}><Camera size={14}/> Carica</button>
              <button type="button" onClick={() => setPhotoType('dicebear')} className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap ${photoType === 'dicebear' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white'}`}>Cartoon</button>
              <button type="button" onClick={() => setPhotoType('url')} className={`px-3 py-2 rounded-lg border text-xs font-bold whitespace-nowrap ${photoType === 'url' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white'}`}>Link Web</button>
            </div>

            <div className="flex items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 min-h-[120px]">
              
              {/* CASO: ATTUALE */}
              {photoType === 'current' && <img src={user.photoURL || '/default-avatar.png'} className="w-20 h-20 rounded-full border-2 border-white shadow object-cover" />}
              
              {/* CASO: UPLOAD (NUOVO) */}
              {photoType === 'upload' && (
                  <div className="text-center w-full">
                    <label className="cursor-pointer block">
                        {uploadedBase64 ? (
                            <img src={uploadedBase64} className="w-20 h-20 rounded-full mx-auto border-4 border-white shadow-md object-cover" />
                        ) : (
                            <div className="w-20 h-20 rounded-full mx-auto bg-white border border-gray-200 flex items-center justify-center text-gray-400 mb-2">
                                <Upload size={24} />
                            </div>
                        )}
                        <span className="mt-2 inline-block text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                            {uploadedBase64 ? 'Cambia Foto' : 'Scegli dalla Galleria'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
              )}

              {/* CASO: CARTOON */}
              {photoType === 'dicebear' && (
                <div className="text-center">
                    <img src={getDiceBearUrl(seed)} className="w-20 h-20 rounded-full border-2 border-white shadow bg-white mx-auto" />
                    <button type="button" onClick={() => setSeed(Math.random().toString())} className="mt-2 text-xs text-purple-600 font-bold flex items-center gap-1 mx-auto bg-purple-50 px-2 py-1 rounded"><RefreshCw size={10}/> Genera altro</button>
                </div>
              )}

              {/* CASO: URL */}
              {photoType === 'url' && (
                 <div className="w-full">
                    <input type="url" placeholder="Incolla link https://..." value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} className="w-full p-2 text-xs border rounded mb-2" />
                    {customUrl && <img src={customUrl} onError={(e) => e.target.style.display='none'} className="w-12 h-12 rounded-full mx-auto border shadow object-cover" />}
                 </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2">
            {loading ? 'Salvataggio...' : <><Save size={18}/> Salva Profilo</>}
          </button>
        </form>
      </div>
    </div>
  );
}
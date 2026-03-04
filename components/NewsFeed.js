'use client';

import { useState, useEffect } from 'react';
import { getGlobalFeed } from '@/lib/firebase';
import { Clock, User, Hourglass, CheckCircle, ShieldAlert, EyeOff, XCircle, Camera, X, Clapperboard } from 'lucide-react';


export default function NewsFeed({ t, systemSettings }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null); 

  const tr = (text) => (t ? t(text) : text);

  const CACHE_KEY = 'fantamatricolata_feed_cache';
  
  // Legge i parametri separati del feed! (Se non ci sono, usa 2 min di default)
  const isFeedCacheEnabled = systemSettings?.feedCacheEnabled ?? true;
  const feedCacheMinutes = systemSettings?.feedCacheDuration ?? 2; 

  useEffect(() => {
    loadFeed();
  }, [isFeedCacheEnabled, feedCacheMinutes]); // Reagisce se l'admin cambia in diretta!

  const loadFeed = async () => {
    try {
      // 1. SE LA CACHE E' SPENTA, PULISCE E SCARICA SUBITO
      if (!isFeedCacheEnabled) {
          localStorage.removeItem(CACHE_KEY);
      } else {
          // 2. CONTROLLO CACHE
          const cachedData = localStorage.getItem(CACHE_KEY);
          if (cachedData) {
              const { data, timestamp } = JSON.parse(cachedData);
              const now = new Date().getTime();
              const diffMinutes = (now - timestamp) / 1000 / 60;

              if (diffMinutes < feedCacheMinutes) {
                  setFeed(data); 
                  setLoading(false);
                  return; // Esce a zero letture!
              }
          }
      }

      // 3. CHIAMA FIREBASE (Ora la tua funzione ottimizzata farà solo 1-20 letture)
      const data = await getGlobalFeed();
      
      // 4. PREPARA I DATI E SALVA IN CACHE (se abilitata)
      const serializableData = data.map(item => {
          let dateStr = null;
          const rawDate = item.createdAt || item.timestamp;
          if (rawDate) {
              dateStr = rawDate.toDate ? rawDate.toDate().toISOString() : new Date(rawDate).toISOString();
          }
          const { createdAt, timestamp, ...rest } = item; 
          return { ...rest, _cachedDate: dateStr };
      });

      if (isFeedCacheEnabled) {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
              data: serializableData,
              timestamp: new Date().getTime()
          }));
      }

      setFeed(serializableData);

    } catch (e) {
      console.error("Errore caricamento feed:", e);
    } finally {
      setLoading(false);
    }
  };

  const getValidDate = (item) => {
      // Helper per recuperare la data sia che venga dalla cache (stringa) sia da Firebase
      const dateVal = item._cachedDate || item.createdAt || item.timestamp;
      if (!dateVal) return null;
      if (typeof dateVal === 'string') return new Date(dateVal);
      return dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  };

  const formatTime = (item) => {
    const date = getValidDate(item);
    if (!date) return '';
    return date.toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const getDateLabel = (item) => {
    const date = getValidDate(item);
    if (!date) return tr('Data sconosciuta');
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return tr('Oggi');
    if (date.toDateString() === yesterday.toDateString()) return tr('Ieri');
    
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  if (loading) return <div className="text-center py-10 text-gray-400">{tr("Caricamento...")}</div>;

  return (
    <div className="space-y-6 pb-24">
      
      {feed.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm mt-4">
           <p className="text-gray-400">{tr("Nessun dato.")}</p>
        </div>
      ) : (
        feed.map((item, index) => {
          const isMalus = item.puntiRichiesti < 0;
          const isPending = item.status === 'pending';
          const isManual = item.manual === true;
          const isRejected = item.status === 'rejected'; 
          const isPhoto = !!item.photoProof;
          const isHidden = item.isHidden === true; 
          
          const currentDateLabel = getDateLabel(item);
          const prevItem = feed[index-1];
          const prevDateLabel = index > 0 ? getDateLabel(prevItem) : null;
          const showDivider = currentDateLabel !== prevDateLabel;

          // LOGICA TESTI E COLORI (Con Traduzione)
          let statusLabel = "";
          let statusColor = "";
          let actionText = "";
          let cardOpacity = "opacity-100"; 

          if (isRejected) {
              statusLabel = tr("Rifiutato");
              statusColor = "bg-red-50 text-red-500 border-red-100";
              actionText = tr("Richiesta Rifiutata") + ":"; 
              cardOpacity = "opacity-75 grayscale-[0.5]"; 
          } else if (isPending) {
              statusLabel = tr("Controllo VAR"); 
              statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
              actionText = tr("Richiesta inviata") + ":"; 
          } else if (isManual) {
              statusLabel = tr("Admin");
              statusColor = "bg-black-100 text-black-700 border-black-200";
              
              if (isHidden) {
                  actionText = isMalus ? tr("Ha preso un Malus Nascosto:") : tr("Ha preso un Bonus Nascosto:");
              } else {
                  actionText = isMalus ? tr("Ha preso un Malus:") : tr("Ha preso un Bonus:"); 
              }
          } else {
              statusLabel = tr("Approvato");
              statusColor = "bg-green-100 text-green-700 border-green-200";
              actionText = tr("Richiesta approvata") + ":"; 
          }

          return (
            
            <div key={item.id} className={cardOpacity}>
                <div className="flex justify-start mt-2">
                {isFeedCacheEnabled && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1 uppercase font-bold bg-gray-100 px-2 py-1 rounded-full">
                    <Clock size={10} /> Aggiornato ogni {feedCacheMinutes} min
                  </span>
                )}
              </div>
              {showDivider && (
                <div className="flex items-center justify-center my-6">
                    <div className="h-px bg-gray-200 w-12"></div>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest mx-2 shadow-sm border border-gray-200">
                        {currentDateLabel}
                    </span>
                    <div className="h-px bg-gray-200 w-12"></div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                
                <div className="p-3 flex items-center justify-between border-b border-gray-50 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border bg-white ${isMalus ? 'border-red-200' : 'border-blue-200'}`}>
                        {item.userPhoto ? (
                          <img src={item.userPhoto} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User size={18} className={isMalus ? "text-red-400" : "text-blue-400"}/>
                        )}
                      </div>
                      <div>
                        <p className={`font-bold text-sm leading-tight ${isRejected ? 'line-through text-gray-500' : 'text-gray-900'}`}>{item.userName}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10}/> {formatTime(item)}
                        </p>
                      </div>
                  </div>

                  <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${statusColor} ${isPending ? 'animate-pulse' : ''}`}>
                    {isPending && <img src="/var_icon.png" className="w-5 h-5 inline" alt="VAR" />}
                    {isRejected && <XCircle size={10} />}
                    {!isPending && !isRejected && isManual && <ShieldAlert size={10} />}
                    {!isPending && !isRejected && !isManual && <CheckCircle size={10} />}
                    {statusLabel}
                  </span>
                </div>

                <div className="p-4">
                   <p className="text-gray-500 text-xs mb-1.5 uppercase tracking-wide font-bold flex items-center gap-1">
                      {isHidden && isManual && <EyeOff size={12}/>} {actionText}
                   </p>
                   
                   <div className="flex items-center justify-between">
                       <span className={`font-bold text-base leading-tight ${isRejected ? 'text-gray-400 line-through' : (isMalus ? 'text-red-700' : 'text-gray-900')}`}>
                           {item.challengeName}
                       </span>
                       {!isRejected && (
                           <span className={`text-sm font-black px-2 py-1 rounded-lg ${isMalus ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                               {item.puntiRichiesti > 0 ? '+' : ''}{item.puntiRichiesti}
                           </span>
                       )}
                       {isRejected && (
                           <span className="text-sm font-black px-2 py-1 rounded-lg bg-gray-100 text-gray-400">
                               0
                           </span>
                       )}
                   </div>
                </div>

                {isPhoto && (
                  <div className="w-full bg-gray-100 relative group cursor-pointer border-t border-gray-100" onClick={() => setSelectedImage(item.photoProof)}>
                      <img src={item.photoProof} className={`w-full h-auto object-cover max-h-[400px] min-h-[200px] ${isRejected ? 'grayscale' : ''}`} alt="Prova"/>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-2">
                             <Camera size={14} /> {tr("Ingrandisci")}
                          </div>
                      </div>
                  </div>
                )}

              </div>
            </div>
          );
        })
      )}

      {selectedImage && (
        <div 
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-2 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedImage(null)}
        >
            <button className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 p-3 rounded-full z-50">
                <X size={24} />
            </button>
            <img src={selectedImage} className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} alt="Zoomed prova" />
        </div>
      )}

    </div>
  );
}
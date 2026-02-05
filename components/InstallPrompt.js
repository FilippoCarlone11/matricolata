'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Smartphone, Download, MoreVertical } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(true); 

  useEffect(() => {
    // 0. CONTROLLO DISPOSITIVO: Se è un PC, fermati subito.
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|blackberry|iemobile/i.test(userAgent);
    
    // Se NON è mobile, non fare nulla (esci dalla funzione)
    if (!isMobile) return;

    // 1. Controlla se l'app è già installata
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(checkStandalone);
    if (checkStandalone) return; 

    // 2. Rileva iOS
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Cattura l'evento di installazione (Solo Android/Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); 
      setDeferredPrompt(e); 
      // Se Android ci dà l'evento, mostriamo subito il popup col tasto nero
      setShowPrompt(true); 
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. TIMER DI SICUREZZA (SOLO PER MOBILE)
    // Se dopo 3 secondi non è successo nulla (es. iOS o Android "pigro"), 
    // forziamo l'apertura del popup con le istruzioni manuali.
    const timer = setTimeout(() => {
        if (!checkStandalone) {
            setShowPrompt(true);
        }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); 
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  // Se è già installata o non dobbiamo mostrarlo, non renderizziamo nulla
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-500">
        
        <button 
          onClick={() => setShowPrompt(false)} 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 p-1 rounded-full"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="bg-gradient-to-br from-red-500 to-orange-500 p-3 rounded-2xl shadow-lg mb-4">
            <Smartphone className="text-white" size={32} />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">Installa l'App</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Aggiungi l'app alla Home per ricevere notifiche e accedere velocemente.
          </p>

          {/* CASO 1: Abbiamo il "bottone magico" di Android */}
          {deferredPrompt ? (
            <button 
              onClick={handleInstallClick}
              className="w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Download size={20} /> Installa Ora
            </button>
          ) : (
            /* CASO 2: Istruzioni Manuali (iOS o Android senza evento) */
            <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100 text-left space-y-3">
               
               {isIOS ? (
                 // Istruzioni iOS
                 <>
                   <div className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="bg-white p-1.5 rounded-md shadow-sm border"><Share size={18} className="text-blue-500"/></span>
                      <span>1. Tocca <b>Condividi</b></span>
                   </div>
                   <div className="h-px bg-gray-200 w-full"></div>
                   <div className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="bg-white p-1.5 rounded-md shadow-sm border"><PlusSquare size={18} className="text-gray-600"/></span>
                      <span>2. <b>"Aggiungi alla Home"</b></span>
                   </div>
                 </>
               ) : (
                 // Istruzioni Android Manuali (Fallback)
                 <>
                   <div className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="bg-white p-1.5 rounded-md shadow-sm border"><MoreVertical size={18} className="text-gray-600"/></span>
                      <span>1. Tocca i <b>3 puntini</b> in alto</span>
                   </div>
                   <div className="h-px bg-gray-200 w-full"></div>
                   <div className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="bg-white p-1.5 rounded-md shadow-sm border"><Smartphone size={18} className="text-gray-600"/></span>
                      <span>2. <b>"Installa app"</b> o <b>"Aggiungi a Home"</b></span>
                   </div>
                 </>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
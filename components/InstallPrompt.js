'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Smartphone, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // 1. Controlla se l'app è già installata (Standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    if (isStandalone) {
      return; // Se è già installata, non fare nulla
    }

    // 2. Controlla se è un dispositivo iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Gestione Android/Chrome (Cattura l'evento di installazione)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); // Preveniamo il prompt automatico (spesso bloccato)
      setDeferredPrompt(e); // Salviamo l'evento per attivarlo col bottone
      setShowPrompt(true); // Mostriamo il nostro popup
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Se è iOS, mostriamo il prompt subito (perché non esiste l'evento beforeinstallprompt)
    if (isIosDevice) {
      // Piccolo ritardo per non aggredire l'utente appena apre la pagina
      setTimeout(() => setShowPrompt(true), 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt(); // Lancia il prompt nativo di Android
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

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
            Per un'esperienza migliore, aggiungi questa app alla schermata Home. Funziona come un'app nativa!
          </p>

          {isIOS ? (
            /* ISTRUZIONI IOS */
            <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100 text-left space-y-3">
               <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="bg-white p-1.5 rounded-md shadow-sm border"><Share size={18} className="text-blue-500"/></span>
                  <span>1. Tocca il tasto <b>Condividi</b> in basso</span>
               </div>
               <div className="h-px bg-gray-200 w-full"></div>
               <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="bg-white p-1.5 rounded-md shadow-sm border"><PlusSquare size={18} className="text-gray-600"/></span>
                  <span>2. Scorri e seleziona <b>"Aggiungi alla schermata Home"</b></span>
               </div>
            </div>
          ) : (
            /* BOTTONE ANDROID */
            <button 
              onClick={handleInstallClick}
              className="w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Download size={20} /> Installa Ora
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
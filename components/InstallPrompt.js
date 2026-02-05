'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Smartphone, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // 1. Controlla se l'app è già installata (Standalone mode)
    // Se l'utente sta già usando l'app installata, non mostriamo nulla.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    if (isStandalone) {
      return; 
    }

    // 2. Controlla se è un dispositivo iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Gestione Android/Chrome (Cattura l'evento REALE di installazione)
    const handleBeforeInstallPrompt = (e) => {
      // Blocchiamo il banner standard di Chrome per mostrare il nostro più bello
      e.preventDefault(); 
      // Salviamo l'evento "magico" che ci permette di lanciare l'installazione dopo
      setDeferredPrompt(e); 
      // Ora possiamo mostrare il nostro popup
      setShowPrompt(true); 
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Gestione iOS (Nessun evento, mostriamo dopo un ritardo)
    if (isIosDevice) {
      // Aspettiamo 3 secondi per non aggredire l'utente appena entra
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Se siamo qui, siamo su Android e abbiamo l'evento salvato
    if (!deferredPrompt) return;
    
    // Lanciamo il prompt nativo del sistema
    deferredPrompt.prompt(); 
    
    // Attendiamo la scelta dell'utente
    const { outcome } = await deferredPrompt.userChoice;
    
    // Se accetta o rifiuta, chiudiamo comunque il nostro popup
    if (outcome === 'accepted') {
      console.log('Utente ha accettato installazione');
    }
    setShowPrompt(false);
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
            /* ISTRUZIONI IOS (Perché Apple non permette il tasto installa) */
            <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100 text-left space-y-3">
               <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="bg-white p-1.5 rounded-md shadow-sm border"><Share size={18} className="text-blue-500"/></span>
                  <span>1. Tocca <b>Condividi</b></span>
               </div>
               <div className="h-px bg-gray-200 w-full"></div>
               <div className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="bg-white p-1.5 rounded-md shadow-sm border"><PlusSquare size={18} className="text-gray-600"/></span>
                  <span>2. Seleziona <b>"Aggiungi alla Home"</b></span>
               </div>
            </div>
          ) : (
            /* BOTTONE ANDROID (Lancia l'evento reale) */
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
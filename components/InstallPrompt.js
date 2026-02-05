'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Smartphone, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // 1. Controlla se l'app è già installata
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return; 

    // 2. Controlla iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Gestione Android/Chrome
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); 
      setDeferredPrompt(e); 
      setShowPrompt(true); 
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // --- DEBUG: FORZA IL POPUP DOPO 1 SECONDO ---
    // Questo serve per vedere la grafica anche se il browser non vuole.
    // RICORDATI DI TOGLIERE QUESTO TIMEOUT QUANDO HAI FINITO DI TESTARE!
    const timer = setTimeout(() => {
        setShowPrompt(true);
    }, 1000);
    // ---------------------------------------------

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
        // Se siamo in modalità "forzata" e non c'è l'evento reale,
        // mostriamo un alert per dire che graficamente è ok.
        alert("Grafica OK! (Su un telefono vero qui partirebbe l'installazione)");
        setShowPrompt(false);
        return;
    }
    
    deferredPrompt.prompt(); 
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
            Per un'esperienza migliore, aggiungi questa app alla schermata Home.
          </p>

          {isIOS ? (
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
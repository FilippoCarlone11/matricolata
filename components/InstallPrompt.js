'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Smartphone, Download, MoreVertical } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Parte true per non flashare

  useEffect(() => {
    // 0. BLOCCO PC: Se non è un telefono/tablet, fermati subito.
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|blackberry|iemobile/i.test(userAgent);
    
    if (!isMobile) return; // Se sei su PC, il componente muore qui.

    // 1. Controlla se l'app è già installata
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(checkStandalone);
    if (checkStandalone) return; 

    // 2. Rileva se è iOS (iPhone/iPad)
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. LOGICA ANDROID AUTOMATICA (Il bottone magico)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); // Blocca il banner brutto di Chrome
      setDeferredPrompt(e); // Salviamo l'evento "magico"
      setShowPrompt(true); // Mostriamo subito il nostro popup
      console.log("Evento installazione catturato! Mostro bottone.");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. TIMER DI RISERVA (Per iOS o se Android è lento)
    // Se dopo 3 secondi non è successo nulla (nessun evento catturato), 
    // mostriamo comunque il popup con le istruzioni manuali.
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
    // Se abbiamo il "bottone magico" salvato, usiamolo
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    } else {
        // Caso impossibile se il codice è giusto, ma per sicurezza chiudiamo
        setShowPrompt(false);
    }
  };

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
            Aggiungi l'app alla Home per un'esperienza migliore e per ricevere le notifiche.
          </p>

          {/* LOGICA VISIVA: 
              Se abbiamo catturato l'evento (deferredPrompt esiste) -> Mostra Bottone AUTOMATICO.
              Se NO (es: iOS o Android senza evento) -> Mostra ISTRUZIONI MANUALI.
          */}
          
          {deferredPrompt ? (
            <button 
              onClick={handleInstallClick}
              className="w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Download size={20} /> Installa Ora
            </button>
          ) : (
            <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100 text-left space-y-3">
               {isIOS ? (
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
                 <>
                   <div className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="bg-white p-1.5 rounded-md shadow-sm border"><MoreVertical size={18} className="text-gray-600"/></span>
                      <span>1. Tocca i <b>3 puntini</b> in alto</span>
                   </div>
                   <div className="h-px bg-gray-200 w-full"></div>
                   <div className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="bg-white p-1.5 rounded-md shadow-sm border"><Smartphone size={18} className="text-gray-600"/></span>
                      <span>2. <b>"Installa app"</b></span>
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
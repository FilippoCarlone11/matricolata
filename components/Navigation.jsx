'use client';
import { Users, Trophy, Target, Shield, BookOpen, List, Flag, Newspaper } from 'lucide-react';

// AGGIUNTO 't' ALLE PROPS
export default function Navigation({ activeTab, setActiveTab, role, t }) {
  const tabs = [];

  // Funzione helper sicura: se t esiste lo usa, altrimenti usa il testo originale
  const tr = (text) => (t ? t(text) : text);

  // --- TAB COMUNE A TUTTI ---
  tabs.push({ id: 'feed', label: tr('Feed'), icon: Newspaper });

  // CASO 1: MATRICOLA
  if (role === 'matricola') {
    tabs.push({ id: 'home', label: tr('Richieste'), icon: Target }); 
    tabs.push({ id: 'percorso', label: tr('Archivio'), icon: Flag });
    tabs.push({ id: 'lista', label: tr('Bonus/Malus'), icon: List });
  } 
  
  // CASO 2: ALTRI (Utente, Admin, Super Admin)
  else {
    tabs.push({ id: 'squadra', label: tr('Squadra'), icon: Users });
    tabs.push({ id: 'classifiche', label: tr('Classifiche'), icon: Trophy });

    // CASO 2b: SOLO UTENTE SEMPLICE (Non Admin) vede la lista consultativa
    if (role === 'utente') {
        tabs.push({ id: 'lista', label: tr('Bonus/Malus'), icon: List });
    }
  }

  // CASO 3: TAB AMMINISTRATIVI (Solo Admin/SuperAdmin)
  if (role === 'admin' || role === 'super-admin') {
    tabs.push({ id: 'admin-sfide', label: tr('Bonus/Malus'), icon: Target });
  }

  // CASO 4: TAB SUPER ADMIN
  if (role === 'super-admin') {
    tabs.push({ id: 'admin-utenti', label: tr('Utenti'), icon: Shield });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 pb-6 md:pb-0">
      <div className="max-w-lg mx-auto flex overflow-x-auto no-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 min-w-[70px] flex flex-col items-center gap-1 transition-all ${
                isActive ? 'text-[#B41F35]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] font-bold uppercase tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
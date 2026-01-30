'use client';
import { Users, Trophy, Target, Shield, BookOpen, List, Flag } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, role }) {
  const tabs = [];

  // CASO 1: MATRICOLA
  if (role === 'matricola') {
    tabs.push({ id: 'home', label: 'Home', icon: Target });
    tabs.push({ id: 'percorso', label: 'Percorso', icon: Flag });
    tabs.push({ id: 'lista', label: 'Bonus/Malus', icon: List });
  } 
  
  // CASO 2: ALTRI (Utente, Admin, Super Admin)
  else {
    tabs.push({ id: 'squadra', label: 'Squadra', icon: Users });
    tabs.push({ id: 'classifiche', label: 'Classifiche', icon: Trophy });

    // CASO 2b: SOLO UTENTE SEMPLICE (Non Admin) vede la lista consultativa
    // Gli admin hanno la gestione interna, inutile duplicare
    if (role === 'utente') {
        tabs.push({ id: 'lista', label: 'Bonus/Malus', icon: List });
    }
  }

  // CASO 3: TAB AMMINISTRATIVI (Solo Admin/SuperAdmin)
  if (role === 'admin' || role === 'super-admin') {
    tabs.push({ id: 'admin-sfide', label: 'Bonus/Malus', icon: Target });
    tabs.push({ id: 'admin-matricole', label: 'Matricole', icon: BookOpen });
  }

  // CASO 4: TAB SUPER ADMIN
  if (role === 'super-admin') {
    tabs.push({ id: 'admin-utenti', label: 'Utenti', icon: Shield });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 pb-safe">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          const isAdminTab = tab.id.startsWith('admin');
          const activeColor = isAdminTab ? 'text-blue-600' : 'text-red-600';

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all ${
                isActive ? activeColor : 'text-gray-400 hover:text-gray-600'
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
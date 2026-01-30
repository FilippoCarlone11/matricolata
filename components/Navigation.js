'use client';
import { Users, Trophy, Target, Shield, BookOpen, List, Flag } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, role }) {
  const tabs = [];

  // 1. TAB BASE (Matricola)
  if (role === 'matricola') {
    tabs.push({ id: 'home', label: 'Home', icon: Target });
    tabs.push({ id: 'lista', label: 'Listone', icon: List });
    tabs.push({ id: 'percorso', label: 'Percorso', icon: Flag }); // NUOVO TAB
  } else {
    // Utente, Admin, Super Admin
    tabs.push({ id: 'squadra', label: 'Squadra', icon: Users });
    tabs.push({ id: 'classifiche', label: 'Classifiche', icon: Trophy });
  }

  // 2. TAB AMMINISTRATIVI
  if (role === 'admin' || role === 'super-admin') {
    tabs.push({ id: 'admin-sfide', label: 'Gest. Sfide', icon: Target });
    tabs.push({ id: 'admin-matricole', label: 'Matricole', icon: BookOpen });
  }

  // 3. TAB SUPER ESCLUSIVI
  if (role === 'super-admin') {
    tabs.push({ id: 'admin-utenti', label: 'Gest. Utenti', icon: Shield });
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
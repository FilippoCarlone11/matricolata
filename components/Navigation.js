'use client';
import { Users, Trophy, Target, Shield, BookOpen } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, role }) {
  // Tab base per tutti (Utenti e Admin)
  const tabs = [
    { id: 'squadra', label: 'Squadra', icon: Users },
    { id: 'classifiche', label: 'Classifiche', icon: Trophy },
  ];

  // Se è ADMIN, aggiungiamo DUE tab separati
  if (role === 'admin') {
    tabs.push({ id: 'admin-sfide', label: 'Sfide', icon: Target });
    tabs.push({ id: 'admin-matricole', label: 'Matricole', icon: BookOpen }); // NUOVO TAB
    tabs.push({ id: 'admin-utenti', label: 'Utenti', icon: Shield });}

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 pb-safe">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          // Calcolo colore: Rosso per i tab normali, Blu/Viola per quelli Admin per distinguerli
          const activeColor = tab.id.startsWith('admin') ? 'text-blue-600' : 'text-red-600';

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
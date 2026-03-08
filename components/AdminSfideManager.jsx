'use client';

import { useState } from 'react';
import AdminRequests from '@/components/AdminRequests';
import AdminChallenges from '@/components/AdminChallenges';
import { Inbox, Settings2 } from 'lucide-react';

export default function AdminSfideManager({t}) {
  const [activeView, setActiveView] = useState('requests'); // 'requests' | 'settings'

  return (
    <div className="space-y-6">
      
      {/* HEADER + SWITCHER */}
      <div>
        
        {/* SLIDER / SWITCHER */}
        <div className="bg-gray-200 p-1.5 rounded-xl flex relative">
          {/* Sfondo animato (opzionale, qui usiamo css condizionale semplice) */}
          <button 
            onClick={() => setActiveView('requests')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all duration-200 ${
              activeView === 'requests' 
                ? 'bg-white shadow text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Inbox size={18} /> 
            Richieste
          </button>
          
          <button 
            onClick={() => setActiveView('settings')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all duration-200 ${
              activeView === 'settings' 
                ? 'bg-white shadow text-[#B41F35]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings2 size={18} /> 
            Crea & Modifica
          </button>
        </div>
      </div>

      {/* CONTENUTO DINAMICO */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeView === 'requests' ? (
           <AdminRequests t = {t}/>
        ) : (
           <AdminChallenges t = {t}/>
        )}
      </div>

    </div>
  );
}
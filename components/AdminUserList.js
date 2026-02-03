'use client';

import { useState, useEffect } from 'react';
import { updateUserRole, deleteUserDocument, getSystemSettings, toggleRegistrations, updateCacheSettings } from '@/lib/firebase';
import { Users, UserCheck, Crown, Trash2, Key, Search, Lock, Unlock, ShieldAlert, Zap, ZapOff, Clock, Save } from 'lucide-react';

export default function AdminUserList({ currentUser, preloadedUsers = [] }) {
  const [users, setUsers] = useState(preloadedUsers);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); 

  // STATI SISTEMA
  const [regOpen, setRegOpen] = useState(true);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheDuration, setCacheDuration] = useState(30);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const isSuperAdmin = currentUser?.role === 'super-admin';

  useEffect(() => {
    if (preloadedUsers.length > 0) setUsers(preloadedUsers);
  }, [preloadedUsers]);

  // Carica impostazioni
  useEffect(() => {
    if (isSuperAdmin) {
        const loadSettings = async () => {
            try {
                const settings = await getSystemSettings();
                setRegOpen(settings?.registrationsOpen ?? true);
                setCacheEnabled(settings?.cacheEnabled ?? true);
                setCacheDuration(settings?.cacheDuration ?? 30);
            } catch (e) { console.error(e); }
            finally { setSettingsLoading(false); }
        };
        loadSettings();
    }
  }, [isSuperAdmin]);

  const handleToggleReg = async () => {
    const newState = !regOpen;
    setRegOpen(newState); 
    await toggleRegistrations(newState);
  };

  // --- FUNZIONE SALVATAGGIO CON DEBUG ---
  const saveCacheSettings = async (newEnabled, newDuration) => {
    setSettingsLoading(true);
    // Cambiamo UI subito per reattività
    setCacheEnabled(newEnabled);
    
    try {
        await updateCacheSettings(newEnabled, newDuration);
    } catch (e) { 
        console.error("Errore salvataggio:", e);
        alert("ERRORE SALVATAGGIO: Controlla la console o i permessi Firebase.");
        // Se fallisce, torniamo allo stato precedente
        setCacheEnabled(!newEnabled);
    }
    finally { setSettingsLoading(false); }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!isSuperAdmin) return;
    setUpdatingUser(userId);
    try { 
        await updateUserRole(userId, newRole); 
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) { alert(e); }
    finally { setUpdatingUser(null); }
  };

  const handleDeleteUser = async (user) => {
    if (!isSuperAdmin) return;
    if (prompt(`Per eliminare ${user.displayName} scrivi ELIMINA:`) !== "ELIMINA") return;
    try { 
        await deleteUserDocument(user.id); 
        setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (e) { alert(e); }
  };

  const counts = users.reduce((acc, u) => {
    const r = u.role || 'sconosciuto';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, { matricola: 0, utente: 0, admin: 0, 'super-admin': 0 });

  const filteredUsers = users.filter(u => 
    (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-20">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Users className="text-blue-600" /> Gestione Utenti
      </h2>

      {/* --- PANNELLO CONTROLLO SUPER ADMIN --- */}
      {isSuperAdmin && (
        <div className="bg-white text-black p-4 rounded-xl shadow-lg border border-slate-700 mb-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                 <ShieldAlert className="text-red-500" size={20} />
                 <h3 className="font-bold text-lg leading-tight">Pannello Super Admin</h3>
            </div>
            
            <div className="space-y-4">
                {/* 1. ISCRIZIONI */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span className="text-sm font-bold text-gray-700">Nuovi Utenti</span>
                    <button 
                        onClick={handleToggleReg}
                        disabled={settingsLoading}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${
                            regOpen 
                            ? 'bg-green-600 text-white shadow-md' 
                            : 'bg-red-600 text-white shadow-md'
                        }`}
                    >
                        {regOpen ? <><Unlock size={14}/> Aperti</> : <><Lock size={14}/> Bloccati</>}
                    </button>
                </div>

                {/* 2. GESTIONE CACHE E DURATA */}
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-blue-900 flex items-center gap-2">
                            <Zap size={16} className={cacheEnabled ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}/> 
                            Cache Dati
                        </span>
                        
                        <button 
                            onClick={() => saveCacheSettings(!cacheEnabled, cacheDuration)}
                            disabled={settingsLoading}
                            className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                                cacheEnabled 
                                ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' 
                                : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                            }`}
                        >
                            {cacheEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                        <Clock size={16} className="text-blue-400"/>
                        <span className="text-xs text-blue-800 font-medium">Aggiorna ogni:</span>
                        <input 
                            type="number" 
                            value={cacheDuration}
                            onChange={(e) => setCacheDuration(e.target.value)}
                            className="w-16 p-1 text-center text-sm font-bold rounded border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <span className="text-xs text-blue-800">minuti</span>
                        <button 
                            onClick={() => saveCacheSettings(cacheEnabled, cacheDuration)}
                            className="ml-auto bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700 transition-colors"
                            title="Salva durata"
                        >
                            <Save size={14} />
                        </button>
                    </div>
                    <p className="text-[9px] text-blue-400 mt-2 leading-tight">
                        Se ON: Risparmi soldi (dati vecchi di {cacheDuration}m).<br/>
                        Se OFF: Costo alto (dati live).
                    </p>
                </div>
            </div>
        </div>
      )}

      {/* DASHBOARD CONTEGGI */}
      <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Users size={18}/></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matricole</span>
              </div>
              <span className="text-2xl font-black text-gray-900">{counts.matricola || 0}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="bg-green-100 p-2 rounded-lg text-green-600"><UserCheck size={18}/></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Utenti</span>
              </div>
              <span className="text-2xl font-black text-gray-900">{counts.utente || 0}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><Key size={18}/></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Admin</span>
              </div>
              <span className="text-2xl font-black text-gray-900">{counts.admin || 0}</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600"><Crown size={18}/></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Super</span>
              </div>
              <span className="text-2xl font-black text-gray-900">{counts['super-admin'] || 0}</span>
          </div>
      </div>

      {/* BARRA DI RICERCA */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input 
            type="text" 
            placeholder="Cerca nome o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
        />
      </div>

      {/* LISTA UTENTI */}
      <div className="space-y-3">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-3">
             <div className="relative">
                <img src={user.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full bg-gray-100 object-cover border border-gray-200" />
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold text-white ${
                    user.role === 'super-admin' ? 'bg-yellow-500' :
                    user.role === 'admin' ? 'bg-purple-500' :
                    user.role === 'matricola' ? 'bg-blue-500' : 'bg-gray-400'
                }`}>
                    {user.role ? user.role[0].toUpperCase() : '?'}
                </span>
             </div>
            
            <div className="flex-1 overflow-hidden">
               <div className="flex justify-between items-start">
                   <h3 className="font-bold text-gray-900 truncate pr-2">{user.displayName || 'Senza Nome'}</h3>
                   {isSuperAdmin && (
                      <button onClick={() => handleDeleteUser(user)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Elimina">
                        <Trash2 size={16} />
                      </button>
                   )}
               </div>
               
               <p className="text-xs text-gray-500 truncate">{user.email}</p>
               
               <div className="flex flex-wrap items-center gap-2 mt-2">
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                    user.role === 'super-admin' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    user.role === 'matricola' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-gray-50 text-gray-700 border-gray-200'
                 }`}>
                    {user.role}
                 </span>
                 
                 {user.teamName && (
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {user.teamName}
                    </span>
                 )}
               </div>

               {/* CONTROLLI RUOLO (VECCHIO STILE A BOTTONI SCORREVOLI) */}
               {isSuperAdmin && (
                 <div className="flex gap-1 mt-3 pt-3 border-t border-gray-50 overflow-x-auto pb-1 no-scrollbar">
                    {['matricola', 'utente', 'admin', 'super-admin'].map(role => (
                    <button 
                        key={role} 
                        onClick={() => handleRoleChange(user.id, role)} 
                        disabled={user.role === role || updatingUser === user.id} 
                        className={`flex-shrink-0 px-2 py-1 rounded-md font-bold text-[9px] uppercase transition-all border ${
                            user.role === role 
                            ? 'bg-gray-900 text-white border-gray-900' 
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                    >
                        {role === 'super-admin' ? 'Super' : role}
                    </button>
                    ))}
                 </div>
               )}
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Nessun utente trovato.</div>
        )}
      </div>
    </div>
  );
}
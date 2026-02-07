'use client';

import { useState, useEffect } from 'react';
// AGGIUNTO: toggleMatricolaBlur
import { updateUserRole, deleteUserDocument, getSystemSettings, toggleRegistrations, updateCacheSettings, toggleMatricolaBlur } from '@/lib/firebase';
// AGGIUNTO: Ghost
import { Users, UserCheck, Crown, Trash2, Key, Search, Lock, Unlock, ShieldAlert, Zap, Clock, Save, Ghost } from 'lucide-react';

export default function AdminUserList({ currentUser, preloadedUsers = [] }) {
  const [users, setUsers] = useState(preloadedUsers);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); 

  // STATI SISTEMA
  const [regOpen, setRegOpen] = useState(true);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheDuration, setCacheDuration] = useState(30);
  const [blurEnabled, setBlurEnabled] = useState(false); // <--- NUOVO STATO
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
                setBlurEnabled(settings?.matricolaBlur ?? false); // <--- CARICA STATO BLUR
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

  const saveCacheSettings = async (newEnabled, newDuration) => {
    setSettingsLoading(true);
    setCacheEnabled(newEnabled);
    try {
        await updateCacheSettings(newEnabled, newDuration);
    } catch (e) { 
        alert("Errore salvataggio settings");
        setCacheEnabled(!newEnabled);
    }
    finally { setSettingsLoading(false); }
  };

  // NUOVA FUNZIONE: Toggle Blur
  const handleToggleBlur = async () => {
    const newState = !blurEnabled;
    setBlurEnabled(newState); // Aggiorna UI subito per reattività
    try {
        await toggleMatricolaBlur(newState);
    } catch (e) {
        alert("Errore aggiornamento blur");
        setBlurEnabled(!newState); // Revert in caso di errore
    }
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

      {/* --- PANNELLO CONTROLLO SUPER ADMIN (Ridisegnato) --- */}
      {isSuperAdmin && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
            
            <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-3 relative z-10">
                 <ShieldAlert className="text-yellow-400" size={20} />
                 <h3 className="font-bold text-lg leading-tight">System Control</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {/* 1. ISCRIZIONI */}
                <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div>
                        <span className="block text-sm font-bold text-gray-200">Registrazioni</span>
                        <span className="text-[10px] text-gray-400">Permetti nuovi iscritti</span>
                    </div>
                    <button 
                        onClick={handleToggleReg}
                        disabled={settingsLoading}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${
                            regOpen ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-red-500 text-white'
                        }`}
                    >
                        {regOpen ? <><Unlock size={14}/> ON</> : <><Lock size={14}/> OFF</>}
                    </button>
                </div>

                {/* 2. GESTIONE CACHE */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <span className="block text-sm font-bold text-gray-200 flex items-center gap-2">
                                Cache Dati <Zap size={14} className={cacheEnabled ? "text-yellow-400 fill-yellow-400" : "text-gray-500"}/> 
                            </span>
                            <span className="text-[10px] text-gray-400">Risparmio letture DB</span>
                        </div>
                        <button 
                            onClick={() => saveCacheSettings(!cacheEnabled, cacheDuration)}
                            disabled={settingsLoading}
                            className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${
                                cacheEnabled ? 'bg-blue-600 justify-end' : 'bg-gray-600 justify-start'
                            }`}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg">
                        <Clock size={14} className="text-slate-400"/>
                        <span className="text-xs text-slate-300">Reset ogni:</span>
                        <input 
                            type="number" 
                            value={cacheDuration}
                            onChange={(e) => setCacheDuration(e.target.value)}
                            className="w-12 bg-transparent text-center text-sm font-bold text-white border-b border-slate-600 focus:border-blue-500 outline-none"
                        />
                        <span className="text-xs text-slate-300">min</span>
                        <button onClick={() => saveCacheSettings(cacheEnabled, cacheDuration)} className="ml-auto text-blue-400 hover:text-white transition-colors">
                            <Save size={16} />
                        </button>
                    </div>
                </div>

                {/* 3. NUOVO BLOCCO: MATRICOLA BLUR */}
                <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700 md:col-span-2">
                    <div>
                        <span className="block text-sm font-bold text-gray-200 flex items-center gap-2">
                           Blackout Matricole <Ghost size={14} className={blurEnabled ? "text-purple-400" : "text-gray-500"}/>
                        </span>
                        <span className="text-[10px] text-gray-400">Oscura il sito alle matricole</span>
                    </div>
                    <button 
                        onClick={handleToggleBlur}
                        disabled={settingsLoading}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${
                            blurEnabled ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-gray-600 text-gray-300'
                        }`}
                    >
                        {blurEnabled ? 'ATTIVO' : 'SPENTO'}
                    </button>
                </div>

            </div>
        </div>
      )}

      {/* DASHBOARD CONTEGGI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Matricole', count: counts.matricola, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Utenti', count: counts.utente, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Admin', count: counts.admin, icon: Key, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Super', count: counts['super-admin'], icon: Crown, color: 'text-yellow-600', bg: 'bg-yellow-50' }
          ].map((stat, i) => (
             <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                 <div className={`${stat.bg} ${stat.color} p-2 rounded-full mb-1`}>
                    <stat.icon size={18} />
                 </div>
                 <span className="text-2xl font-black text-gray-900 leading-none">{stat.count || 0}</span>
                 <span className="text-[10px] font-bold text-gray-400 uppercase">{stat.label}</span>
             </div>
          ))}
      </div>

      {/* BARRA DI RICERCA */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
        <input 
            type="text" 
            placeholder="Cerca nome o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 p-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white shadow-sm transition-all"
        />
      </div>

      {/* LISTA UTENTI */}
      <div className="space-y-4">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
             
             {/* HEADER CARD */}
             <div className="p-4 flex items-start gap-3">
                <div className="relative">
                    <img src={user.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full bg-gray-50 object-cover border border-gray-100" />
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white border-2 border-white ${
                        user.role === 'super-admin' ? 'bg-yellow-500' :
                        user.role === 'admin' ? 'bg-purple-500' :
                        user.role === 'matricola' ? 'bg-blue-500' : 'bg-gray-400'
                    }`}>
                        {user.role ? user.role[0].toUpperCase() : '?'}
                    </span>
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-gray-900 truncate text-base">{user.displayName || 'Senza Nome'}</h3>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        {isSuperAdmin && (
                            <button onClick={() => handleDeleteUser(user)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {user.teamName && (
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                Team: {user.teamName}
                            </span>
                        )}
                    </div>
                </div>
             </div>

             {/* SELETTORE RUOLO */}
             {isSuperAdmin && (
                 <div className="bg-gray-50 p-3 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-1 bg-gray-200/50 p-1 rounded-xl">
                        {['matricola', 'utente', 'admin', 'super-admin'].map(role => {
                            const isActive = user.role === role;
                            return (
                                <button 
                                    key={role} 
                                    onClick={() => handleRoleChange(user.id, role)} 
                                    disabled={isActive || updatingUser === user.id} 
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                        isActive 
                                        ? 'bg-white text-gray-900 shadow-sm scale-100' 
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 scale-95'
                                    }`}
                                >
                                    {role === 'super-admin' ? 'Super' : role}
                                </button>
                            );
                        })}
                    </div>
                 </div>
             )}
          </div>
        ))}

        {filteredUsers.length === 0 && (
            <div className="text-center py-10">
                <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                    <Search className="text-gray-300" size={30}/>
                </div>
                <p className="text-gray-400 text-sm">Nessun utente trovato.</p>
            </div>
        )}
      </div>
    </div>
  );
}
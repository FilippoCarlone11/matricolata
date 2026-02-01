'use client';

import { useState, useEffect } from 'react';
// HO AGGIUNTO QUI: getSystemSettings, toggleRegistrations
import { onUsersChange, updateUserRole, deleteUserDocument, getSystemSettings, toggleRegistrations } from '@/lib/firebase';
// HO AGGIUNTO QUI: Lock, Unlock, ShieldAlert
import { Users, UserCheck, Crown, Trash2, Key, Search, Lock, Unlock, ShieldAlert } from 'lucide-react';

export default function AdminUserList({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); 

  // --- NUOVI STATI PER IL BOTTONE REGISTRAZIONI ---
  const [regOpen, setRegOpen] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const isSuperAdmin = currentUser?.role === 'super-admin';

  useEffect(() => {
    const unsubscribe = onUsersChange((updatedUsers) => {
      setUsers(updatedUsers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- NUOVO EFFETTO: CARICA STATO REGISTRAZIONI ---
  useEffect(() => {
    if (isSuperAdmin) {
        const loadSettings = async () => {
            try {
                const settings = await getSystemSettings();
                // Se settings esiste usa quello, altrimenti true di default
                setRegOpen(settings?.registrationsOpen ?? true);
            } catch (e) { console.error(e); }
            finally { setSettingsLoading(false); }
        };
        loadSettings();
    }
  }, [isSuperAdmin]);

  // --- NUOVA FUNZIONE: CAMBIA STATO REGISTRAZIONI ---
  const handleToggleReg = async () => {
    const newState = !regOpen;
    setRegOpen(newState); 
    await toggleRegistrations(newState);
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!isSuperAdmin) return;
    setUpdatingUser(userId);
    try { await updateUserRole(userId, newRole); }
    catch (error) { alert('Errore aggiornamento ruolo'); }
    finally { setUpdatingUser(null); }
  };

  const handleDeleteUser = async (user) => {
    if (!isSuperAdmin) return;
    if (prompt(`Per eliminare ${user.displayName} scrivi ELIMINA:`) !== "ELIMINA") return;
    try { await deleteUserDocument(user.id); alert("Utente eliminato."); } catch (e) { alert(e); }
  };

  // --- CALCOLO STATISTICHE ---
  const counts = users.reduce((acc, u) => {
    const r = u.role || 'sconosciuto';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, { matricola: 0, utente: 0, admin: 0, 'super-admin': 0 });

  // --- FILTRO RICERCA ---
  const filteredUsers = users.filter(u => 
    (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="text-center py-8 text-gray-400">Caricamento utenti...</div>;

  return (
    <div className="pb-20">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Users className="text-blue-600" /> Gestione Utenti
      </h2>

      {/* ------------------------------------------------------- */}
      {/* NUOVO BLOCCO: CONTROLLO REGISTRAZIONI (SOLO SUPER ADMIN) */}
      {/* ------------------------------------------------------- */}
      {isSuperAdmin && (
        <div className="bg-white text-black p-4 rounded-xl shadow-lg border border-slate-700 mb-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="text-red-400" size={24} />
                    <div>
                        <h3 className="font-bold text-lg leading-tight">Controllo Accessi</h3>
                        <p className="text-slate-400 text-xs">Blocca o sblocca nuovi accessi</p>
                    </div>
                </div>

                <button 
                    onClick={handleToggleReg}
                    disabled={settingsLoading}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-wider ${
                        regOpen 
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                    }`}
                >
                    {settingsLoading ? '...' : (
                        regOpen ? <><Unlock size={16}/> Iscrizioni Aperte</> : <><Lock size={16}/> Iscrizioni Chiuse</>
                    )}
                </button>
            </div>
            
        </div>
      )}
      {/* ------------------------------------------------------- */}


      {/* --- DASHBOARD CONTEGGI --- */}
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
            <img src={user.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full bg-gray-100 object-cover border border-gray-200" />
            
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

              {/* CONTROLLI RUOLO (SOLO SUPER ADMIN) */}
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
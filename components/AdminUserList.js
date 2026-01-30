'use client';

import { useState, useEffect } from 'react';
import { onUsersChange, updateUserRole, deleteUserDocument } from '@/lib/firebase'; 
import { Users, UserCheck, Crown, Trash2, Key } from 'lucide-react'; 

export default function AdminUserList({ currentUser }) { 
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);

  const isSuperAdmin = currentUser?.role === 'super-admin';

  useEffect(() => {
    const unsubscribe = onUsersChange((updatedUsers) => {
      setUsers(updatedUsers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const getRoleIcon = (role) => {
    switch (role) {
      case 'super-admin': return <Key size={20} className="text-yellow-600" />;
      case 'admin': return <Crown size={20} className="text-purple-600" />;
      case 'utente': return <UserCheck size={20} className="text-blue-600" />;
      default: return <Users size={20} className="text-gray-600" />;
    }
  };

  if (loading) return <div className="text-center py-12">Caricamento...</div>;

  return (
    <div className="space-y-3">
      {!isSuperAdmin && (
          <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs mb-4 border border-red-200 font-bold text-center">
              Accesso Negato. Solo i Super Admin possono vedere questa pagina.
          </div>
      )}

      {users.map(user => (
        <div key={user.id} className="bg-white rounded-2xl p-5 shadow-md border border-gray-200">
          <div className="flex items-start gap-4 mb-4">
            <img src={user.photoURL || '/default-avatar.png'} className="w-14 h-14 rounded-full border-2 border-gray-200" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 mb-1 overflow-hidden">
                      <h3 className="font-bold text-lg text-gray-900 truncate">{user.displayName}</h3>
                      {getRoleIcon(user.role)}
                  </div>
                  
                  {/* SOLO TASTO ELIMINA (SOLO SUPER ADMIN) */}
                  {isSuperAdmin && user.role !== 'super-admin' && (
                      <button onClick={() => handleDeleteUser(user)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 border border-red-200 transition-colors" title="Elimina Utente">
                        <Trash2 size={20} />
                      </button>
                  )}
              </div>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              {user.teamName && <p className="text-xs font-bold text-purple-600 mt-1">Team: {user.teamName}</p>}
              
              <div className="mt-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase bg-gray-100`}>{user.role}</span>
              </div>
            </div>
          </div>
          
          {/* CONTROLLI RUOLO (SOLO SUPER ADMIN) */}
          {isSuperAdmin && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
                {['matricola', 'utente', 'admin', 'super-admin'].map(role => (
                <button key={role} onClick={() => handleRoleChange(user.id, role)} disabled={user.role === role || updatingUser === user.id} className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-[10px] uppercase transition-all ${user.role === role ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-200'} disabled:opacity-50`}>{role === 'super-admin' ? 'S-ADM' : role}</button>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
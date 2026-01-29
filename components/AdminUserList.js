'use client';

import { useState, useEffect } from 'react';
import { getAllUsers, updateUserRole, onUsersChange } from '@/lib/firebase';
import { Users, Shield, UserCheck, Crown } from 'lucide-react';

export default function AdminUserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);

  useEffect(() => {
    // Realtime listener
    const unsubscribe = onUsersChange((updatedUsers) => {
      setUsers(updatedUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingUser(userId);
    try {
      await updateUserRole(userId, newRole);
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Errore durante l\'aggiornamento del ruolo');
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Crown size={20} className="text-purple-600" />;
      case 'utente':
        return <UserCheck size={20} className="text-blue-600" />;
      default:
        return <Users size={20} className="text-gray-600" />;
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-purple-100 text-purple-700 border-purple-300',
      utente: 'bg-blue-100 text-blue-700 border-blue-300',
      matricola: 'bg-gray-100 text-gray-700 border-gray-300'
    };
    
    return badges[role] || badges.matricola;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Caricamento utenti...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield size={28} className="text-red-600" />
          Gestione Utenti
        </h2>
        <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full font-bold">
          {users.length} utenti
        </span>
      </div>

      <div className="space-y-3">
        {users.map(user => (
          <div
            key={user.id}
            className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-4 mb-4">
              {/* Avatar */}
              <img
                src={user.photoURL || '/default-avatar.png'}
                alt={user.displayName}
                className="w-14 h-14 rounded-full border-2 border-gray-200"
              />
              
              {/* User Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg text-gray-900">{user.displayName}</h3>
                  {getRoleIcon(user.role)}
                </div>
                <p className="text-sm text-gray-600">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadge(user.role)}`}>
                    {user.role?.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-500">
                    • {user.punti || 0} punti
                  </span>
                </div>
              </div>
            </div>

            {/* Role Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleRoleChange(user.id, 'matricola')}
                disabled={user.role === 'matricola' || updatingUser === user.id}
                className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition-all ${
                  user.role === 'matricola'
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                Matricola
              </button>
              
              <button
                onClick={() => handleRoleChange(user.id, 'utente')}
                disabled={user.role === 'utente' || updatingUser === user.id}
                className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition-all ${
                  user.role === 'utente'
                    ? 'bg-blue-200 text-blue-700 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                } disabled:opacity-50`}
              >
                Utente
              </button>
              
              <button
                onClick={() => handleRoleChange(user.id, 'admin')}
                disabled={user.role === 'admin' || updatingUser === user.id}
                className={`flex-1 py-2 px-4 rounded-xl font-semibold text-sm transition-all ${
                  user.role === 'admin'
                    ? 'bg-purple-200 text-purple-700 cursor-not-allowed'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                } disabled:opacity-50`}
              >
                Admin
              </button>
            </div>

            {updatingUser === user.id && (
              <div className="mt-2 text-center text-sm text-gray-500">
                Aggiornamento in corso...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
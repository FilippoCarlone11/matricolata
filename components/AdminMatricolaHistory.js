'use client';

import { useState, useEffect } from 'react';
import { getAllUsers, getApprovedRequestsByUser, revokeApprovedRequest, manualAddPoints, getChallenges, assignExistingChallenge } from '@/lib/firebase';
import { Search, Calendar, Trash2, PlusCircle, ArrowLeft, Frown, Zap } from 'lucide-react';

export default function AdminMatricolaHistory() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [groupedHistory, setGroupedHistory] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Stati per assegnazione bonus esistente
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableChallenges, setAvailableChallenges] = useState([]);

  useEffect(() => {
    const loadUsers = async () => {
      const data = await getAllUsers();
      setUsers(data.filter(u => u.role === 'matricola'));
      setLoading(false);
    };
    loadUsers();
  }, []);

  const handleSelectUser = async (user) => {
    setLoading(true);
    setSelectedUser(user);
    await loadUserHistory(user.id);
    setLoading(false);
  };

  const loadUserHistory = async (userId) => {
    const data = await getApprovedRequestsByUser(userId);
    const grouped = data.reduce((acc, item) => {
      const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
      const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(item);
      return acc;
    }, {});
    setGroupedHistory(grouped);
  };

  const handleRevoke = async (req) => {
    if (!confirm(`Annullare "${req.challengeName}" e rimuovere ${req.puntiRichiesti} punti?`)) return;
    try {
      await revokeApprovedRequest(req.id, selectedUser.id, req.puntiRichiesti);
      loadUserHistory(selectedUser.id);
    } catch (e) { alert("Errore: " + e); }
  };

  // ASSEGNAZIONE MANUALE (Punti liberi)
  const handleAddManual = async () => {
    const pointsStr = prompt("Punti (+ o -):", "10");
    if (!pointsStr) return;
    const reason = prompt("Motivo?", "Bonus Extra");
    try {
      await manualAddPoints(selectedUser.id, parseInt(pointsStr), reason);
      loadUserHistory(selectedUser.id);
    } catch (e) { alert(e); }
  };

  // ASSEGNAZIONE DA LISTA
  const openAssignModal = async () => {
    const challs = await getChallenges();
    setAvailableChallenges(challs);
    setShowAssignModal(true);
  };

  const handleAssignExisting = async (challenge) => {
    if(!confirm(`Assegnare "${challenge.titolo}" (${challenge.punti} pt) a ${selectedUser.displayName}?`)) return;
    try {
        await assignExistingChallenge(selectedUser.id, challenge.id, challenge.punti, challenge.titolo);
        setShowAssignModal(false);
        loadUserHistory(selectedUser.id);
    } catch(e) { alert(e); }
  };

  const filteredUsers = users.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- VISTA 1: RICERCA ---
  if (!selectedUser) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Cerca Matricola</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            type="text" placeholder="Scrivi il nome..." className="w-full pl-10 p-3 rounded-xl border border-gray-300"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">
          {filteredUsers.map(u => (
            <button key={u.id} onClick={() => handleSelectUser(u)} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-purple-50 text-left">
              <img src={u.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <p className="font-bold text-gray-900">{u.displayName}</p>
                <p className="text-xs text-gray-500">{u.punti} punti</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- VISTA 2: DETTAGLIO ---
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-purple-50 p-4 rounded-2xl border border-purple-100">
        <button onClick={() => setSelectedUser(null)} className="bg-white p-2 rounded-full shadow-sm"><ArrowLeft size={20}/></button>
        <img src={selectedUser.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full border-2 border-white shadow" />
        <div className="flex-1">
          <h2 className="font-bold text-lg text-purple-900">{selectedUser.displayName}</h2>
          <p className="text-xs text-purple-600">Matricola</p>
        </div>
      </div>
      
      {/* TOOLBAR AZIONI */}
      <div className="flex gap-2">
          <button onClick={openAssignModal} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow hover:bg-blue-700">
            <Zap size={16}/> Assegna Bonus/Malus
          </button>
          <button onClick={handleAddManual} className="flex-1 bg-gray-800 text-white p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow hover:bg-gray-900">
            <PlusCircle size={16}/> Manuale
          </button>
      </div>

      <div className="space-y-6">
        {Object.keys(groupedHistory).length === 0 ? (
          <div className="text-center py-10 text-gray-400"><Frown size={48} className="mx-auto mb-2 opacity-50"/><p>Nessun dato.</p></div>
        ) : (
          Object.keys(groupedHistory).map(date => (
            <div key={date}>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Calendar size={14}/> {date}</h3>
              <div className="space-y-2">
                {groupedHistory[date].map(item => {
                   const isMalus = item.puntiRichiesti < 0;
                   return (
                    <div key={item.id} className={`bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm ${isMalus ? 'border-red-100 bg-red-50/30' : 'border-gray-200'}`}>
                        <div>
                        <p className={`font-bold text-sm ${isMalus ? 'text-red-900' : 'text-gray-800'}`}>{item.challengeName}</p>
                        <p className="text-xs text-gray-400">{item.manual ? 'Assegnazione Admin' : 'Sfida'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                        <span className={`font-black ${isMalus ? 'text-red-600' : 'text-green-600'}`}>{item.puntiRichiesti > 0 ? '+' : ''}{item.puntiRichiesti}</span>
                        <button onClick={() => handleRevoke(item)} className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600"><Trash2 size={16} /></button>
                        </div>
                    </div>
                   );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODALE LISTA BONUS/MALUS */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAssignModal(false)}>
            <div className="bg-white w-full max-w-sm max-h-[80vh] rounded-2xl p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-4">Scegli cosa assegnare</h3>
                <div className="space-y-2">
                    {availableChallenges.map(c => (
                        <button key={c.id} onClick={() => handleAssignExisting(c)} className="w-full flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 text-left">
                            <span className="font-medium text-sm">{c.titolo}</span>
                            <span className={`font-bold text-xs ${c.punti < 0 ? 'text-red-600' : 'text-green-600'}`}>{c.punti > 0 ? '+' : ''}{c.punti}</span>
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowAssignModal(false)} className="w-full mt-4 p-3 bg-gray-100 rounded-xl font-bold text-sm">Annulla</button>
            </div>
        </div>
      )}
    </div>
  );
}
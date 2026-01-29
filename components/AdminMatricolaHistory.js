'use client';

import { useState, useEffect } from 'react';
import { getAllUsers, getApprovedRequestsByUser, revokeApprovedRequest, manualAddPoints } from '@/lib/firebase';
import { Search, Calendar, Trash2, PlusCircle, User, ArrowLeft, Frown } from 'lucide-react';

export default function AdminMatricolaHistory() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]); // Storico grezzo
  const [groupedHistory, setGroupedHistory] = useState({}); // Storico raggruppato per data
  const [loading, setLoading] = useState(true);

  // 1. Carica lista utenti per la ricerca
  useEffect(() => {
    const loadUsers = async () => {
      const data = await getAllUsers();
      // Filtra solo le matricole
      setUsers(data.filter(u => u.role === 'matricola'));
      setLoading(false);
    };
    loadUsers();
  }, []);

  // 2. Quando selezioni un utente, carica il suo storico
  const handleSelectUser = async (user) => {
    setLoading(true);
    setSelectedUser(user);
    await loadUserHistory(user.id);
    setLoading(false);
  };

  const loadUserHistory = async (userId) => {
    const data = await getApprovedRequestsByUser(userId);
    setHistory(data);
    groupDataByDate(data);
  };

  // Funzione helper per raggruppare per data
  const groupDataByDate = (data) => {
    const grouped = data.reduce((acc, item) => {
      // Converti timestamp in stringa leggibile (DD/MM/YYYY)
      const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
      const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(item);
      return acc;
    }, {});
    setGroupedHistory(grouped);
  };

  // AZIONE: Revoca Punti
  const handleRevoke = async (req) => {
    if (!confirm(`Sei sicuro di voler annullare "${req.challengeName}" e togliere ${req.puntiRichiesti} punti?`)) return;
    
    try {
      await revokeApprovedRequest(req.id, selectedUser.id, req.puntiRichiesti);
      alert("Sfida annullata e punti rimossi.");
      loadUserHistory(selectedUser.id); // Ricarica
    } catch (e) {
      alert("Errore: " + e);
    }
  };

  // AZIONE: Aggiungi Punti Extra qui
  const handleAddBonus = async () => {
    const pointsStr = prompt("Punti extra da aggiungere:", "10");
    if (!pointsStr) return;
    const reason = prompt("Motivo?", "Bonus Extra");
    
    try {
      await manualAddPoints(selectedUser.id, parseInt(pointsStr), reason);
      loadUserHistory(selectedUser.id); // Ricarica
    } catch (e) { alert(e); }
  };

  const filteredUsers = users.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- VISTA 1: RICERCA UTENTE ---
  if (!selectedUser) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <User className="text-purple-600" /> Cerca Matricola
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            type="text" placeholder="Scrivi il nome..." className="w-full pl-10 p-3 rounded-xl border border-gray-300"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">
          {filteredUsers.map(u => (
            <button key={u.id} onClick={() => handleSelectUser(u)} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-purple-50 transition-all text-left">
              <img src={u.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <p className="font-bold text-gray-900">{u.displayName}</p>
                <p className="text-xs text-gray-500">{u.punti} punti totali</p>
              </div>
              <div className="bg-gray-100 p-2 rounded-full"><ArrowLeft size={16} className="rotate-180 text-gray-400" /></div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- VISTA 2: DETTAGLIO UTENTE E STORICO ---
  return (
    <div className="space-y-6">
      {/* Header Utente */}
      <div className="flex items-center gap-4 bg-purple-50 p-4 rounded-2xl border border-purple-100">
        <button onClick={() => setSelectedUser(null)} className="bg-white p-2 rounded-full shadow-sm hover:bg-gray-100"><ArrowLeft size={20}/></button>
        <img src={selectedUser.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full border-2 border-white shadow" />
        <div className="flex-1">
          <h2 className="font-bold text-lg text-purple-900">{selectedUser.displayName}</h2>
          <p className="text-xs text-purple-600">Matricola selezionata</p>
        </div>
        <button onClick={handleAddBonus} className="bg-purple-600 text-white p-2 rounded-xl flex items-center gap-1 text-xs font-bold shadow hover:bg-purple-700">
          <PlusCircle size={16}/> Bonus
        </button>
      </div>

      {/* Lista Storico per Giorni */}
      <div className="space-y-6">
        {Object.keys(groupedHistory).length === 0 ? (
          <div className="text-center py-10 text-gray-400 flex flex-col items-center">
            <Frown size={48} className="mb-2 opacity-50"/>
            <p>Nessuna sfida completata.</p>
          </div>
        ) : (
          Object.keys(groupedHistory).map(date => (
            <div key={date}>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Calendar size={14}/> {date}
              </h3>
              <div className="space-y-2">
                {groupedHistory[date].map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center shadow-sm">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{item.challengeName}</p>
                      <p className="text-xs text-gray-400">
                        {item.manual ? 'Assegnazione Manuale' : 'Sfida completata'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-green-600">+{item.puntiRichiesti}</span>
                      <button 
                        onClick={() => handleRevoke(item)} 
                        className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Annulla e togli punti"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
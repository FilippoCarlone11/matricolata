'use client';

import { useState, useEffect } from 'react';
import { 
  getAllUsers, 
  getApprovedRequestsByUser, 
  revokeApprovedRequest, 
  manualAddPoints, 
  getChallenges, 
  assignExistingChallenge 
} from '@/lib/firebase';
import { Search, Calendar, Trash2, PlusCircle, ArrowLeft, Frown, Zap, EyeOff, Users, CheckCircle } from 'lucide-react';

export default function AdminMatricolaHistory() {
  // Stati Dati
  const [matricole, setMatricole] = useState([]);
  const [squadCounts, setSquadCounts] = useState({}); // Mappa: ID Matricola -> Numero di squadre che ce l'hanno
  const [loading, setLoading] = useState(true);

  // Stati UI Navigazione
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null); // Se null, mostra la lista. Se popolato, mostra i dettagli.
  
  // Stati Dettaglio Utente
  const [groupedHistory, setGroupedHistory] = useState({});
  
  // Stati Modale Assegnazione
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableChallenges, setAvailableChallenges] = useState([]);

  // 1. CARICAMENTO INIZIALE (Utenti + Conteggio Squadre)
  useEffect(() => {
    const loadData = async () => {
      try {
        const allUsers = await getAllUsers();
        
        // A. Filtriamo solo le matricole per la lista visualizzabile
        const matricoleOnly = allUsers.filter(u => u.role === 'matricola');
        setMatricole(matricoleOnly);

        // B. Calcoliamo quante squadre possiedono ogni matricola
        const counts = {};
        allUsers.forEach(user => {
            // Se l'utente ha una squadra...
            if (user.mySquad && Array.isArray(user.mySquad)) {
                user.mySquad.forEach(matricolaId => {
                    // Incrementiamo il contatore per quell'ID
                    counts[matricolaId] = (counts[matricolaId] || 0) + 1;
                });
            }
        });
        setSquadCounts(counts);
        setLoading(false);
      } catch (e) {
        console.error("Errore caricamento utenti:", e);
      }
    };
    loadData();
  }, []);

  // 2. LOGICA SELEZIONE UTENTE E CARICAMENTO STORICO
  const handleSelectUser = async (user) => {
    setLoading(true);
    setSelectedUser(user);
    await loadUserHistory(user.id);
    setLoading(false);
  };

  const loadUserHistory = async (userId) => {
    const data = await getApprovedRequestsByUser(userId);
    // Raggruppa per data
    const grouped = data.reduce((acc, item) => {
      const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
      const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(item);
      return acc;
    }, {});
    setGroupedHistory(grouped);
  };

  // 3. AZIONI (Revoca, Manuale, Assegna Esistente)
  const handleRevoke = async (req) => {
    if (!confirm(`Annullare "${req.challengeName}" e rimuovere ${req.puntiRichiesti} punti?`)) return;
    try {
      await revokeApprovedRequest(req.id, selectedUser.id, req.puntiRichiesti);
      loadUserHistory(selectedUser.id);
    } catch (e) { alert("Errore: " + e); }
  };

  const handleAddManual = async () => {
    const pointsStr = prompt("Inserisci Punti (+ o -):", "10");
    if (!pointsStr) return;
    const reason = prompt("Inserisci Motivo:", "Bonus Extra");
    try {
      await manualAddPoints(selectedUser.id, parseInt(pointsStr), reason);
      loadUserHistory(selectedUser.id);
    } catch (e) { alert(e); }
  };

  const openAssignModal = async () => {
    const challs = await getChallenges();
    setAvailableChallenges(challs);
    setShowAssignModal(true);
  };

  const handleAssignExisting = async (challenge) => {
    if(!confirm(`Assegnare "${challenge.titolo}" (${challenge.punti} pt) a ${selectedUser.displayName}?`)) return;
    try {
        // Salviamo anche il titolo per lo storico
        await assignExistingChallenge(selectedUser.id, challenge.id, challenge.punti, challenge.titolo);
        setShowAssignModal(false);
        loadUserHistory(selectedUser.id);
    } catch(e) { alert(e); }
  };


  // --- RENDER ---

  // VISTA 1: LISTA DI RICERCA
  if (!selectedUser) {
    const filteredUsers = matricole.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Search size={24} className="text-blue-600"/> Cerca Matricola
        </h2>
        
        {/* Barra di ricerca */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Scrivi il nome..." 
            className="w-full p-3 pl-4 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista Risultati */}
        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {filteredUsers.map(u => {
             const count = squadCounts[u.id] || 0;
             return (
                <button 
                    key={u.id} 
                    onClick={() => handleSelectUser(u)} 
                    className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-purple-50 hover:border-purple-200 transition-all text-left shadow-sm group"
                >
                <img src={u.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full border border-gray-100 object-cover" />
                
                <div className="flex-1">
                    <p className="font-bold text-gray-900 text-lg leading-tight group-hover:text-purple-700">{u.displayName}</p>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {u.punti} pt
                        </span>
                        
                        {/* NUOVO: CONTEGGIO SQUADRE */}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                            <Users size={12} /> {count} Squadre
                        </span>
                    </div>
                </div>
                </button>
             );
          })}
          {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-4">Nessuna matricola trovata.</p>}
        </div>
      </div>
    );
  }

  // VISTA 2: DETTAGLIO UTENTE SELEZIONATO
  return (
    <div className="space-y-6">
      
      {/* Header Utente */}
      <div className="flex items-center gap-4 bg-purple-50 p-4 rounded-2xl border border-purple-100 shadow-sm">
        <button onClick={() => setSelectedUser(null)} className="bg-white p-2 rounded-full shadow hover:bg-gray-50 text-gray-600">
            <ArrowLeft size={20}/>
        </button>
        <img src={selectedUser.photoURL || '/default-avatar.png'} className="w-14 h-14 rounded-full border-2 border-white shadow" />
        <div className="flex-1">
          <h2 className="font-bold text-xl text-purple-900 leading-tight">{selectedUser.displayName}</h2>
          <div className="flex gap-2 mt-1">
             <span className="text-xs font-bold bg-purple-200 text-purple-800 px-2 py-0.5 rounded">Matricola</span>
             <span className="text-xs font-bold bg-white text-gray-600 px-2 py-0.5 rounded border border-purple-100">
                In {squadCounts[selectedUser.id] || 0} rose
             </span>
          </div>
        </div>
      </div>
      
      {/* Toolbar Azioni */}
      <div className="flex gap-3">
          <button 
            onClick={openAssignModal} 
            className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Zap size={18}/> Assegna Bonus
          </button>
          <button 
            onClick={handleAddManual} 
            className="flex-1 bg-gray-800 text-white p-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-gray-900 active:scale-95 transition-all"
          >
            <PlusCircle size={18}/> Manuale
          </button>
      </div>

      {/* Storico Attività */}
      <div className="space-y-6 mt-6">
        {Object.keys(groupedHistory).length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            <Frown size={48} className="mx-auto mb-2 opacity-30"/>
            <p>Nessun punto registrato.</p>
          </div>
        ) : (
          Object.keys(groupedHistory).map(date => (
            <div key={date} className="animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1">
                <Calendar size={12}/> {date}
              </h3>
              <div className="space-y-2">
                {groupedHistory[date].map(item => {
                   const isMalus = item.puntiRichiesti < 0;
                   return (
                    <div key={item.id} className={`bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm ${isMalus ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                        <div className="flex-1">
                            <p className={`font-bold text-sm ${isMalus ? 'text-red-900' : 'text-gray-800'}`}>
                                {item.challengeName}
                            </p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">
                                {item.manual ? 'Assegnazione Admin' : 'Richiesta Approvata'}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <span className={`font-black text-lg ${isMalus ? 'text-red-600' : 'text-green-600'}`}>
                                {item.puntiRichiesti > 0 ? '+' : ''}{item.puntiRichiesti}
                            </span>
                            <button 
                                onClick={() => handleRevoke(item)} 
                                className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Revoca Punti"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                   );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modale Selezione Bonus */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAssignModal(false)}>
            <div className="bg-white w-full max-w-sm max-h-[80vh] rounded-2xl p-5 overflow-y-auto shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-900">Scegli Bonus/Malus</h3>
                    <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">Chiudi</button>
                </div>
                
                <div className="space-y-2">
                    {availableChallenges.map(c => {
                        const isMalus = c.punti < 0;
                        return (
                        <button 
                            key={c.id} 
                            onClick={() => handleAssignExisting(c)} 
                            className={`w-full flex items-center justify-between p-3 border rounded-xl hover:scale-[1.02] active:scale-95 transition-all text-left ${isMalus ? 'hover:bg-red-50 hover:border-red-200' : 'hover:bg-green-50 hover:border-green-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl filter drop-shadow-sm">{c.icon}</span>
                                <div>
                                    <span className={`font-bold text-sm block ${isMalus ? 'text-gray-800' : 'text-gray-900'}`}>{c.titolo}</span>
                                    {c.hidden && <span className="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded flex items-center gap-1 w-fit mt-1"><EyeOff size={8}/> Nascosto</span>}
                                </div>
                            </div>
                            <span className={`font-black text-sm ${isMalus ? 'text-red-600' : 'text-green-600'}`}>
                                {c.punti > 0 ? '+' : ''}{c.punti}
                            </span>
                        </button>
                    )})}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
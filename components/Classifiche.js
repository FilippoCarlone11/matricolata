'use client';

import { useState, useEffect } from 'react';
import { 
    getUserData, 
    getApprovedRequestsByUser, 
    revokeApprovedRequest, 
    manualAddPoints, 
    getChallenges, 
    assignExistingChallenge 
} from '@/lib/firebase';
import { Trophy, User, Users, Shield, X, Crown, ArrowLeft, Zap, PlusCircle, Calendar, Trash2, EyeOff, Loader2 } from 'lucide-react';

export default function Classifiche({ preloadedUsers = [], currentUser }) {
  const [matricole, setMatricole] = useState([]);
  const [fantallenatori, setFantallenatori] = useState([]);
  const [squadCounts, setSquadCounts] = useState({});
  
  const [view, setView] = useState('fanta'); 
  
  // STATI PER UTENTI NORMALI (Vedi Squadra Fanta)
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetails, setTeamDetails] = useState([]);

  // STATI PER ADMIN (Gestione Matricola)
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminHistory, setAdminHistory] = useState({});
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableChallenges, setAvailableChallenges] = useState([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
    if (preloadedUsers.length > 0) {
        calculateLeaderboards(preloadedUsers);
        calculateSquadCounts(preloadedUsers);
    }
  }, [preloadedUsers]);

  // --- CALCOLI INIZIALI ---
  const calculateLeaderboards = (users) => {
      const m = users.filter(u => u.role === 'matricola').sort((a, b) => (b.punti || 0) - (a.punti || 0));
      
      const f = users
        .filter(u => u.role !== 'matricola')
        .map(allenatore => {
          let fantaPuntiTotali = 0;
          if (allenatore.mySquad) {
            allenatore.mySquad.forEach(mid => {
              const matr = users.find(u => u.id === mid);
              if (matr) {
                const isCaptain = allenatore.captainId === mid;
                fantaPuntiTotali += (matr.punti || 0) * (isCaptain ? 2 : 1);
              }
            });
          }
          return { ...allenatore, fantaPunti: fantaPuntiTotali };
        })
        .sort((a, b) => b.fantaPunti - a.fantaPunti);

      setMatricole(m);
      setFantallenatori(f);
  };

  const calculateSquadCounts = (users) => {
      const counts = {};
      users.forEach(user => {
          if (user.mySquad && Array.isArray(user.mySquad)) {
              user.mySquad.forEach(mid => {
                  counts[mid] = (counts[mid] || 0) + 1;
              });
          }
      });
      setSquadCounts(counts);
  };

  // --- LOGICA CLICK LISTA ---
  const handleItemClick = (item) => {
      if (view === 'fanta') {
          if (!item.mySquad || item.mySquad.length === 0) return;
          setSelectedTeam(item);
          const details = preloadedUsers.filter(u => item.mySquad.includes(u.id));
          setTeamDetails(details);
          return;
      }
      if (view === 'matricole' && isAdmin) {
          handleAdminSelectUser(item);
      }
  };


  // --- LOGICA ADMIN ---
  const handleAdminSelectUser = async (user) => {
    setIsAdminLoading(true);
    setAdminSelectedUser(user);
    await loadUserHistory(user.id);
    setIsAdminLoading(false);
  };

  const refreshAdminUser = async () => {
    if (!adminSelectedUser) return;
    const freshData = await getUserData(adminSelectedUser.id);
    setAdminSelectedUser(freshData); 
    setMatricole(prev => prev.map(u => u.id === freshData.id ? freshData : u).sort((a, b) => b.punti - a.punti));
    await loadUserHistory(adminSelectedUser.id);
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
    setAdminHistory(grouped);
  };

  const handleRevoke = async (req) => {
    if (!confirm(`Annullare "${req.challengeName}" e rimuovere ${req.puntiRichiesti} punti?`)) return;
    try {
      await revokeApprovedRequest(req.id, adminSelectedUser.id, req.puntiRichiesti);
      await refreshAdminUser(); 
    } catch (e) { alert("Errore: " + e); }
  };

  const handleAddManual = async () => {
    const pointsStr = prompt("Inserisci Punti (+ o -):", "10");
    if (!pointsStr) return;
    const reason = prompt("Inserisci Motivo:", "Bonus Extra");
    try {
      await manualAddPoints(adminSelectedUser.id, parseInt(pointsStr), reason);
      await refreshAdminUser();
    } catch (e) { alert(e); }
  };

  const openAssignModal = async () => {
    const challs = await getChallenges();
    setAvailableChallenges(challs);
    setShowAssignModal(true);
  };

  const handleAssignExisting = async (challenge) => {
    if(!confirm(`Assegnare "${challenge.titolo}" (${challenge.punti} pt) a ${adminSelectedUser.displayName}?`)) return;
    try {
        await assignExistingChallenge(adminSelectedUser.id, challenge.id, challenge.punti, challenge.titolo);
        setShowAssignModal(false);
        await refreshAdminUser();
    } catch(e) { alert(e); }
  };


  // --- RENDER COMPONENT ---
  const listItems = view === 'matricole' ? matricole : fantallenatori;

  // OVERLAY ADMIN (Gestione Matricola)
  if (adminSelectedUser && isAdmin) {
      return (
        <div className="fixed inset-0 bg-gray-50 z-[50] overflow-y-auto animate-in slide-in-from-right duration-300">
             <div className="max-w-lg mx-auto p-4 pb-20">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setAdminSelectedUser(null)} className="p-2 bg-white rounded-full shadow border border-gray-200 text-gray-700">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold">Gestione Matricola</h2>
                </div>

                <div className="flex items-center gap-4 bg-[#B41F35]/5 p-4 rounded-2xl border border-[#B41F35]/20 shadow-sm relative overflow-hidden mb-6">
                    <img src={adminSelectedUser.photoURL || '/default-avatar.png'} className="w-16 h-16 rounded-full border-2 border-white shadow z-10" />
                    <div className="flex-1 z-10">
                        <h2 className="font-bold text-xl text-[#B41F35] leading-tight">{adminSelectedUser.displayName}</h2>
                        {/* BADGE SQUADRE NEL DETTAGLIO */}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 mt-1 ${squadCounts[adminSelectedUser.id] > 0 ? 'bg-[#B41F35]/10 text-[#B41F35]' : 'bg-white text-gray-500 border'}`}>
                             <Users size={12} /> In {squadCounts[adminSelectedUser.id] || 0} Squadre
                        </span>
                    </div>
                    <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-[#B41F35]/20 text-center min-w-[80px] z-10">
                        <span className="block text-[10px] uppercase text-gray-400 font-bold">Punti</span>
                        <span className="block text-2xl font-black text-[#B41F35]">{adminSelectedUser.punti || 0}</span>
                    </div>
                </div>

                <div className="flex gap-3 mb-8">
                    <button onClick={openAssignModal} className="flex-1 bg-[#B41F35] text-white p-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-[#90192a] active:scale-95 transition-all">
                        <Zap size={20}/> Assegna Bonus
                    </button>
                    <button onClick={handleAddManual} className="flex-1 bg-gray-800 text-white p-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-gray-900 active:scale-95 transition-all">
                        <PlusCircle size={20}/> Manuale
                    </button>
                </div>

                <h3 className="font-bold text-gray-900 text-lg mb-4">Storico Punti</h3>
                <div className="space-y-6">
                    {isAdminLoading ? (
                        <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-[#B41F35]" /></div>
                    ) : Object.keys(adminHistory).length === 0 ? (
                        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                            <p>Nessun punto registrato.</p>
                        </div>
                    ) : (
                        Object.keys(adminHistory).map(date => (
                            <div key={date}>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1">
                                    <Calendar size={12}/> {date}
                                </h3>
                                <div className="space-y-2">
                                    {adminHistory[date].map(item => {
                                        const isMalus = item.puntiRichiesti < 0;
                                        return (
                                            <div key={item.id} className={`bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm ${isMalus ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                                                <div className="flex-1">
                                                    <p className={`font-bold text-sm ${isMalus ? 'text-red-900' : 'text-gray-800'}`}>{item.challengeName}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">
                                                        {item.manual ? 'Assegnazione Admin' : 'Richiesta Approvata'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-black text-lg ${isMalus ? 'text-red-600' : 'text-green-600'}`}>
                                                        {item.puntiRichiesti > 0 ? '+' : ''}{item.puntiRichiesti}
                                                    </span>
                                                    <button onClick={() => handleRevoke(item)} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
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
                                    <button key={c.id} onClick={() => handleAssignExisting(c)} className={`w-full flex items-center justify-between p-3 border rounded-xl hover:scale-[1.02] active:scale-95 transition-all text-left ${isMalus ? 'hover:bg-red-50 hover:border-red-200' : 'hover:bg-green-50 hover:border-green-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl filter drop-shadow-sm">{c.icon}</span>
                                            <div>
                                                <span className={`font-bold text-sm block ${isMalus ? 'text-gray-800' : 'text-gray-900'}`}>{c.titolo}</span>
                                                {c.hidden && <span className="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded flex items-center gap-1 w-fit mt-1"><EyeOff size={8}/> Nascosto</span>}
                                            </div>
                                        </div>
                                        <span className={`font-black text-sm ${isMalus ? 'text-red-600' : 'text-green-600'}`}>{c.punti > 0 ? '+' : ''}{c.punti}</span>
                                    </button>
                                )})}
                            </div>
                        </div>
                    </div>
                )}
             </div>
        </div>
      );
  }

  // VISTA PRINCIPALE (LISTA CLASSIFICA)
  return (
    <div>
      <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
        <button onClick={() => setView('fanta')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'fanta' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><Shield size={16} /> Squadre</button>
        <button onClick={() => setView('matricole')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'matricole' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><Users size={16} /> Matricole</button>
      </div>

      <div className="space-y-3">
        {listItems.map((item, index) => {
            const count = squadCounts[item.id] || 0; // Calcolo conteggio
            let medalColor = 'bg-white border-gray-200';
            let rankIcon = <span className="font-black text-xl text-gray-400 italic w-8 text-center">#{index + 1}</span>;
            
            if (index === 0) { medalColor = 'bg-yellow-50 border-yellow-300'; rankIcon = <Trophy className="text-yellow-500 w-8" fill="currentColor" fillOpacity={0.2} />; }
            if (index === 1) { medalColor = 'bg-slate-50 border-slate-300'; rankIcon = <Trophy className="text-slate-400 w-8" fill="currentColor" fillOpacity={0.2} />; }
            if (index === 2) { medalColor = 'bg-orange-50 border-orange-200'; rankIcon = <Trophy className="text-orange-500 w-8" fill="currentColor" fillOpacity={0.2} />; }

            const isFanta = view === 'fanta';
            const title = isFanta ? (item.teamName || item.displayName) : item.displayName;
            const subTitle = isFanta ? item.displayName : 'Matricola';
            const isClickable = (isFanta && item.mySquad && item.mySquad.length > 0) || (view === 'matricole' && isAdmin);

            return (
            <div 
                key={item.id} 
                onClick={() => isClickable && handleItemClick(item)}
                className={`flex items-center p-3 rounded-2xl border-2 shadow-sm transition-all ${medalColor} ${isClickable ? 'cursor-pointer hover:scale-[1.02] active:scale-95' : ''}`}
            >
                {rankIcon}
                <img src={item.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full object-cover mx-3 border border-gray-100" />
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-gray-900 truncate text-lg leading-tight ${view === 'matricole' && isAdmin ? 'group-hover:text-[#B41F35]' : ''}`}>{title}</h3>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        {isFanta ? (
                             // --- VISTA SQUADRE: Mostra nome allenatore + bottone vedi ---
                             <>
                                {item.teamName && <User size={10} />} {subTitle}
                                {isClickable && <span className="text-[9px] bg-[#B41F35]/10 text-[#B41F35] font-bold px-1.5 rounded ml-2">Vedi Squadra</span>}
                             </>
                        ) : (
                             // --- VISTA MATRICOLE: Mostra conteggio squadre rosso ---
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${count > 0 ? 'bg-[#B41F35]/10 text-[#B41F35]' : 'bg-gray-50 text-gray-400'}`}>
                                <Users size={12} /> {count} Squadre
                             </span>
                        )}
                    </div>
                </div>
                <div className="text-right pl-2">
                    <span className="block text-2xl font-black text-gray-800 leading-none">{isFanta ? item.fantaPunti : item.punti}</span>
                    <span className="text-[9px] uppercase font-bold text-gray-400">Pt</span>
                </div>
            </div>
            );
        })}
        {listItems.length === 0 && <p className="text-center text-gray-500 py-8">Nessun dato.</p>}
      </div>

      {/* MODALE TEAM DETAILS */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedTeam(null)}>
            <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">{selectedTeam.teamName || "Squadra"}</h3>
                        <p className="text-sm text-gray-500">Allenatore: {selectedTeam.displayName}</p>
                    </div>
                    <button onClick={() => setSelectedTeam(null)} className="p-1 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </div>
                
                <div className="space-y-3">
                    {teamDetails.map(player => {
                            const isCaptain = selectedTeam.captainId === player.id;
                            return (
                            <div key={player.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isCaptain ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
                                <div className="relative">
                                    <img src={player.photoURL || '/default-avatar.png'} className="w-10 h-10 rounded-full border border-white shadow-sm" />
                                    {isCaptain && <div className="absolute -top-2 -right-1 bg-yellow-400 text-white p-0.5 rounded-full shadow"><Crown size={10} fill="white"/></div>}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-gray-900">{player.displayName}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Punti: <b>{player.punti || 0}</b></span>
                                        {isCaptain && <span className="text-[9px] bg-yellow-200 text-yellow-800 px-1 rounded font-bold">x2 CAPITANO</span>}
                                    </div>
                                </div>
                            </div>
                            );
                    })}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { 
    getUserData, 
    getApprovedRequestsByUser, 
    revokeApprovedRequest, 
    manualAddPoints, 
    getChallenges, 
    assignExistingChallenge,
    getSystemSettings,
    updateRequestDate 
} from '@/lib/firebase';
import { Trophy, User, Users, Shield, X, Crown, ArrowLeft, Zap, PlusCircle, Calendar, Trash2, EyeOff, Loader2, Wine, CalendarDays, Search } from 'lucide-react';

export default function Classifiche({ preloadedUsers = [], currentUser, onTriggerYellow }) {
  const [matricole, setMatricole] = useState([]);
  const [fantallenatori, setFantallenatori] = useState([]);
  const [squadCounts, setSquadCounts] = useState({});
  const [captainCounts, setCaptainCounts] = useState({}); 
  
  const [view, setView] = useState('fanta'); 
  
  // STATI PER UTENTI NORMALI
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetails, setTeamDetails] = useState([]);

  // STATI PER ADMIN
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminHistory, setAdminHistory] = useState({});
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableChallenges, setAvailableChallenges] = useState([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(5);
  
  // --- STATI RICERCA ---
  const [challengeSearch, setChallengeSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // --- STATO IMPOSTAZIONI SISTEMA ---
  const [sysSettings, setSysSettings] = useState({
      showDrinkCount: true,
      showSquadCount: true,
      showCaptainIcon: true,
      showEveningPoints: false 
  });

  const [showBcienzEffect, setShowBcienzEffect] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
      const fetchSettings = async () => {
          try {
              const s = await getSystemSettings();
              setSysSettings({
                  showDrinkCount: s?.showDrinkCount !== false,
                  showSquadCount: s?.showSquadCount !== false,
                  showCaptainIcon: s?.showCaptainIcon !== false,
                  showEveningPoints: s?.showEveningPoints === true 
              });
          } catch (e) { console.error("Errore fetch settings", e); }
      };
      fetchSettings();
  }, []);

  const { showDrinkCount, showSquadCount, showCaptainIcon, showEveningPoints } = sysSettings;

  useEffect(() => {
    if (preloadedUsers.length > 0) {
        calculateLeaderboards(preloadedUsers);
        
        if (showSquadCount || showCaptainIcon) {
            calculateSquadCounts(preloadedUsers);
        }
    }
  }, [preloadedUsers, showSquadCount, showCaptainIcon]);

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
                const puntiBase = matr.punti || 0;
                const puntiExtra = isCaptain ? (matr.puntiSerata || 0) : 0; 
                fantaPuntiTotali += (puntiBase + puntiExtra);
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
      const capCounts = {}; 
      
      users.forEach(user => {
          if (user.mySquad && Array.isArray(user.mySquad)) {
              user.mySquad.forEach(mid => {
                  counts[mid] = (counts[mid] || 0) + 1;
              });
          }
          if (user.captainId) {
              capCounts[user.captainId] = (capCounts[user.captainId] || 0) + 1;
          }
      });
      setSquadCounts(counts);
      setCaptainCounts(capCounts); 
  };

  const handleItemClick = (item) => {
      const name = item.displayName ? item.displayName.toLowerCase() : '';

      if (name.includes('bcienz')) triggerBcienzEffect();
      if (name.includes('fisi') && onTriggerYellow) onTriggerYellow();

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

  const triggerBcienzEffect = () => {
      setShowBcienzEffect(true);
      setTimeout(() => setShowBcienzEffect(false), 5000);
  };

  const handleAdminSelectUser = async (user) => {
    setIsAdminLoading(true);
    setAdminSelectedUser(user);
    setHistoryLimit(5);
    setHistorySearch(''); // Reset ricerca storico
    await loadUserHistory(user.id);
    setIsAdminLoading(false);
  };

  const refreshAdminUser = async () => {
    if (!adminSelectedUser) return;
    
    const freshData = await getUserData(adminSelectedUser.id);
    setAdminSelectedUser(freshData); 
    
    const updatedUsers = preloadedUsers.map(u => u.id === freshData.id ? freshData : u);
    calculateLeaderboards(updatedUsers);
    
    await loadUserHistory(adminSelectedUser.id);
  };

  const loadUserHistory = async (userId) => {
    const data = await getApprovedRequestsByUser(userId);
    setAdminHistory(data);
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
    setChallengeSearch(''); // Reset ricerca bonus
    let challs = await getChallenges();
    challs = challs.sort((a, b) => {
        const titleA = a.titolo ? a.titolo.toLowerCase() : '';
        const titleB = b.titolo ? b.titolo.toLowerCase() : '';
        return titleA.localeCompare(titleB);
    });
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

  const handleChangeDate = async (req) => {
    const newDateStr = prompt("Inserisci la nuova data (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!newDateStr) return;

    try {
        const newDate = new Date(newDateStr);
        if (isNaN(newDate.getTime())) {
            alert("Data non valida.");
            return;
        }

        await updateRequestDate(req.id, newDate);
        await refreshAdminUser();
        alert("Data aggiornata con successo.");
    } catch (error) {
        console.error("Errore aggiornamento data:", error);
        alert("Errore durante l'aggiornamento della data.");
    }
  };

  const listItems = view === 'matricole' ? matricole : fantallenatori;

  if (adminSelectedUser && isAdmin) {
      // 1. Filtra lo storico in base alla ricerca
      const filteredHistory = Object.values(adminHistory).filter(item => 
          item.challengeName?.toLowerCase().includes(historySearch.toLowerCase())
      );
      
      // 2. Applica il limite (Mostra altro) SOLO ai risultati filtrati
      const displayedHistory = historySearch.trim() !== '' 
    ? filteredHistory 
    : filteredHistory.slice(0, historyLimit);
      
      // 3. Raggruppa per data
      const groupedHistory = displayedHistory.reduce((acc, item) => {
          const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
          const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
          if (!acc[dateStr]) acc[dateStr] = [];
          acc[dateStr].push(item);
          return acc;
      }, {});

      // Filtra le sfide disponibili nel modale in base alla ricerca
      const filteredChallenges = availableChallenges.filter(c => 
          c.titolo?.toLowerCase().includes(challengeSearch.toLowerCase())
      );

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
                    <img src={adminSelectedUser.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${adminSelectedUser.id}&backgroundColor=fecaca`} className="w-16 h-16 rounded-full border-2 border-white shadow z-10 bg-red-100 object-cover" />
                    <div className="flex-1 z-10">
                        <h2 className="font-bold text-xl text-[#B41F35] leading-tight">{adminSelectedUser.displayName}</h2>
                        
                        <div className="flex flex-wrap gap-2 mt-1">
                            {showSquadCount && squadCounts[adminSelectedUser.id] > 0 && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 bg-[#B41F35]/10 text-[#B41F35]`}>
                                     <Users size={12} /> In {squadCounts[adminSelectedUser.id] || 0} Squadre
                                </span>
                            )}
                            {showCaptainIcon && captainCounts[adminSelectedUser.id] > 0 && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 border border-yellow-200">
                                    <Crown size={12} /> Cap. {captainCounts[adminSelectedUser.id]}
                                </span>
                            )}
                            {showDrinkCount && adminSelectedUser.drinkCount > 0 && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-200">
                                    <Wine size={12} /> x{adminSelectedUser.drinkCount}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-[#B41F35]/20 text-center min-w-[80px] z-10 flex flex-col items-center justify-center">
                        <span className="block text-[10px] uppercase text-gray-400 font-bold">Punti</span>
                        <span className="block text-2xl font-black text-[#B41F35] leading-none">{adminSelectedUser.punti || 0}</span>
                        
                        {showEveningPoints && adminSelectedUser.puntiSerata !== undefined && adminSelectedUser.puntiSerata !== 0 && (
                            <span className={`block text-[10px] font-bold mt-1 ${adminSelectedUser.puntiSerata > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {adminSelectedUser.puntiSerata > 0 ? '+' : ''}{adminSelectedUser.puntiSerata} matricolata
                            </span>
                        )}
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

                {/* SEARCH STORICO PUNTI */}
                <h3 className="font-bold text-gray-900 text-lg mb-3">Storico Punti</h3>
                <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Cerca bonus nello storico..." 
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#B41F35] focus:border-transparent outline-none transition-all shadow-sm"
                    />
                </div>

                <div className="space-y-6">
                    {isAdminLoading ? (
                        <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-[#B41F35]" /></div>
                    ) : Object.keys(groupedHistory).length === 0 ? (
                        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                            <p>{historySearch ? "Nessun risultato trovato." : "Nessun punto registrato."}</p>
                        </div>
                    ) : (
                        <>
                        {Object.keys(groupedHistory).map(date => (
                            <div key={date}>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1">
                                    <Calendar size={12}/> {date}
                                </h3>
                                <div className="space-y-2">
                                    {groupedHistory[date].map(item => {
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
                                                    <button onClick={() => handleChangeDate(item)} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                                        <CalendarDays size={16} />
                                                    </button>
                                                    <button onClick={() => handleRevoke(item)} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {!historySearch && filteredHistory.length > historyLimit && (
                            <div className="text-center mt-4">
                                <button 
                                    onClick={() => setHistoryLimit(prev => prev + 5)}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-xl transition-colors"
                                >
                                    Mostra altro
                                </button>
                            </div>
                        )}
                        </>
                    )}
                </div>

                {/* MODALE ASSEGNA BONUS (CON RICERCA) */}
                {showAssignModal && (
                    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAssignModal(false)}>
                        <div className="bg-white w-full max-w-sm max-h-[85vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-gray-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg text-gray-900">Scegli Bonus/Malus</h3>
                                    <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                                </div>
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Cerca sfide..." 
                                        value={challengeSearch}
                                        onChange={(e) => setChallengeSearch(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#B41F35] focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                            
                            <div className="p-5 overflow-y-auto space-y-2">
                                {filteredChallenges.length === 0 ? (
                                    <p className="text-center text-gray-500 py-4 text-sm">Nessuna sfida trovata.</p>
                                ) : (
                                    filteredChallenges.map(c => {
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
                                    )})
                                )}
                            </div>
                        </div>
                    </div>
                )}
             </div>
        </div>
      );
  }

  return (
    <div>
      {showBcienzEffect && (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
            <style jsx>{`
              @keyframes fishFall {
                0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
                100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
              }
            `}</style>
            {Array.from({ length: 50 }).map((_, i) => {
                const left = Math.random() * 100;
                const duration = Math.random() * 2 + 2; 
                const delay = Math.random() * 2; 
                return (
                <div key={i} className="absolute text-4xl" style={{ left: `${left}%`, top: `-10%`, animation: `fishFall ${duration}s linear infinite`, animationDelay: `${delay}s` }}>
                    🐟 
                </div>
                );
            })}
        </div>
      )}

      <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
        <button onClick={() => setView('fanta')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'fanta' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><Shield size={16} /> Squadre</button>
        <button onClick={() => setView('matricole')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${view === 'matricole' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}><Users size={16} /> Matricole</button>
      </div>

      <div className="space-y-3">
        {listItems.map((item, index) => {
            const count = squadCounts[item.id] || 0; 
            const capCount = captainCounts[item.id] || 0;
            const drinks = item.drinkCount || 0; 

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
                onClick={() => handleItemClick(item)}
                className={`flex items-center p-3 rounded-2xl border-2 shadow-sm transition-all ${medalColor} cursor-pointer active:scale-95`}
            >
                {rankIcon}
                <img src={item.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${item.id}&backgroundColor=fecaca`} className="w-12 h-12 rounded-full object-cover mx-3 border border-gray-100 bg-red-50" />
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-gray-900 truncate text-lg leading-tight ${view === 'matricole' && isAdmin ? 'group-hover:text-[#B41F35]' : ''}`}>{title}</h3>
                    <div className="text-xs text-gray-500 truncate flex flex-wrap items-center gap-1 mt-1">
                        {isFanta ? (
                             <>
                                {item.teamName && <User size={10} />} {subTitle}
                                {isClickable && <span className="text-[9px] bg-[#B41F35]/10 text-[#B41F35] font-bold px-1.5 rounded ml-2">Vedi Squadra</span>}
                             </>
                        ) : (
                             <div className="flex gap-1 flex-wrap">
                                 {showSquadCount && count > 0 && (
                                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 bg-[#B41F35]/10 text-[#B41F35]`}>
                                        <Users size={10} /> {count} Squadre
                                     </span>
                                 )}
                                 {showCaptainIcon && capCount > 0 && (
                                     <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 bg-yellow-100 text-yellow-700 border border-yellow-200">
                                         <Crown size={10} /> {capCount}
                                     </span>
                                 )}
                                 {showDrinkCount && drinks > 0 && (
                                     <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-200">
                                         <Wine size={10} /> x{drinks}
                                     </span>
                                 )}
                             </div>
                        )}
                    </div>
                </div>
                <div className="text-right pl-2 flex flex-col justify-center items-end">
                    <div>
                        <span className="inline-block text-2xl font-black text-gray-800 leading-none">{isFanta ? item.fantaPunti : item.punti}</span>
                        <span className="inline-block text-[9px] uppercase font-bold text-gray-400 ml-1">Pt</span>
                    </div>
                    {/* NUOVO: Mostra i punti serata sotto il punteggio totale */}
                    {!isFanta && showEveningPoints && item.puntiSerata !== undefined && item.puntiSerata !== 0 && (
                        <span className={`block text-[10px] font-bold mt-1 ${item.puntiSerata > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {item.puntiSerata > 0 ? '+' : ''}{item.puntiSerata} matricolata
                        </span>
                    )}
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
                    {[...teamDetails].sort((a, b) => {
                        const aCap = selectedTeam.captainId === a.id ? -1 : 1;
                        const bCap = selectedTeam.captainId === b.id ? -1 : 1;
                        return aCap - bCap;
                        }).map(player => {
                            const isCaptain = selectedTeam.captainId === player.id;
                            const drinks = player.drinkCount || 0; 
                            return (
                            <div key={player.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isCaptain ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
                                <div className="relative">
                                    <img src={player.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${player.id}&backgroundColor=fecaca`} className="w-10 h-10 rounded-full border border-white shadow-sm bg-red-50 object-cover" />
                                    {isCaptain && <div className="absolute -top-2 -right-1 bg-yellow-400 text-white p-0.5 rounded-full shadow"><Crown size={10} fill="white"/></div>}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-gray-900">{player.displayName}</p>
                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                        <span className="text-xs text-gray-500">
                                            Punti: <b>{player.punti || 0}</b>
                                            {isCaptain && player.puntiSerata !== undefined && player.puntiSerata !== 0 && (
                                                <span className={`ml-1 font-bold tracking-tight ${player.puntiSerata > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                    (di cui {player.puntiSerata > 0 ? '+' : ''}{player.puntiSerata * 2} matricolata)
                                                </span>
                                            )}
                                            {showEveningPoints && !isCaptain && player.puntiSerata !== undefined && player.puntiSerata !== 0 && (
                                                <span className={`ml-1 font-bold tracking-tight ${player.puntiSerata > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    di cui {player.puntiSerata > 0 ? '+' : ''}{player.puntiSerata} matricolata
                                                </span>
                                            )}
                                        </span>
                                        {showCaptainIcon && isCaptain && <span className="text-[9px] bg-yellow-200 text-yellow-800 px-1 rounded font-bold">CAPITANO</span>}
                                        {showDrinkCount && drinks > 0 && (
                                            <span className="text-[9px] bg-purple-100 text-purple-700 border border-purple-200 px-1 rounded font-bold shrink-0 flex items-center gap-0.5">
                                                <Wine size={8}/> x{drinks}
                                            </span>
                                        )}
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
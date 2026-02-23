'use client';

import { useState, useEffect } from 'react';
import { 
    auth, db, getAllUsers, 
    createEventTeam, deleteEventTeam, updateEventTeamName, // <-- IMPORTATA NUOVA FUNZIONE
    assignMatricolaToEventTeam, removeMatricolaFromEventTeam,
    createEventChallenge, deleteEventChallenge, resolveEventChallenge,
    revertEventChallenge, addManualPointsToEventTeams
} from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore'; 
// AGGIUNTE ICONE Edit2 e Check
import { Settings, ShieldAlert, Loader2, LogOut, Plus, Trash2, Users, UserMinus, Swords, CheckCircle2, Trophy, Wrench, MonitorPlay, ArrowLeft, Minus, ChevronRight, RotateCcw, Edit2, Check } from 'lucide-react';
import Login from '@/components/Login'; 

const COLORS = [
    { name: 'Rosso', class: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
    { name: 'Blu', class: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
    { name: 'Verde', class: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
    { name: 'Giallo', class: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-500' },
    { name: 'Viola', class: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
];

export default function PuntiDashboard() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // NAVIGAZIONE INTERNA REGIA
  const [activeView, setActiveView] = useState('live'); 
  const [selectedLiveChallenge, setSelectedLiveChallenge] = useState(null); 

  // STATI REGIA SQUADRE
  const [eventTeams, setEventTeams] = useState([]);
  const [allMatricole, setAllMatricole] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(COLORS[0]);

  // STATI MODIFICA NOME SQUADRA
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');

  // STATI REGIA SFIDE
  const [eventChallenges, setEventChallenges] = useState([]);
  const [newChallengeTitle, setNewChallengeTitle] = useState('');
  const [p1, setP1] = useState(150);
  const [p2, setP2] = useState(100);
  const [p3, setP3] = useState(50);

  // STATO INPUT RISULTATI
  const [rawScoresInputs, setRawScoresInputs] = useState({});

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) setUserData({ id: docSnap.id, ...docSnap.data() });
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    const qTeams = query(collection(db, 'event_teams'), orderBy('createdAt', 'asc'));
    const unsubscribeTeams = onSnapshot(qTeams, (snap) => {
        const teams = [];
        snap.forEach(d => teams.push({ id: d.id, ...d.data() }));
        setEventTeams(teams);
    });

    const qChallenges = query(collection(db, 'event_challenges'), orderBy('createdAt', 'desc'));
    const unsubscribeChallenges = onSnapshot(qChallenges, (snap) => {
        const challenges = [];
        snap.forEach(d => challenges.push({ id: d.id, ...d.data() }));
        setEventChallenges(challenges);
        
        if (selectedLiveChallenge && !selectedLiveChallenge.isManual) {
            const updatedChallenge = challenges.find(c => c.id === selectedLiveChallenge.id);
            if (updatedChallenge) setSelectedLiveChallenge(updatedChallenge);
        }
    });

    const fetchUsers = async () => {
        const users = await getAllUsers();
        setAllMatricole(users.filter(u => u.role === 'matricola'));
    };
    fetchUsers();

    return () => {
        unsubscribeAuth();
        unsubscribeTeams();
        unsubscribeChallenges();
    };
  }, [selectedLiveChallenge]);

  // --- AZIONI SQUADRE ---
  const handleCreateTeam = async (e) => {
      e.preventDefault();
      if (!newTeamName.trim()) return;
      try { await createEventTeam(newTeamName, newTeamColor.class); setNewTeamName(''); } 
      catch (err) { alert(err.message); }
  };

  const handleDeleteTeam = async (teamId) => {
      if(confirm("Sei sicuro di voler eliminare questa squadra della serata?")) await deleteEventTeam(teamId);
  };

  const handleStartEditTeam = (team) => {
      setEditingTeamId(team.id);
      setEditingTeamName(team.name);
  };

  const handleSaveTeamName = async (teamId) => {
      if (!editingTeamName.trim()) {
          setEditingTeamId(null);
          return;
      }
      try {
          await updateEventTeamName(teamId, editingTeamName);
          setEditingTeamId(null);
      } catch (error) {
          alert("Errore durante il salvataggio: " + error.message);
      }
  };

  // --- AZIONI SFIDE ---
  const handleCreateChallenge = async (e) => {
      e.preventDefault();
      if (!newChallengeTitle.trim()) return;
      try {
          await createEventChallenge(newChallengeTitle, Number(p1), Number(p2), Number(p3));
          setNewChallengeTitle('');
      } catch (err) { alert(err.message); }
  };

  const incrementScore = (challengeId, teamId, delta, allowNegative = false) => {
      setRawScoresInputs(prev => {
          const currentScore = (prev[challengeId] || {})[teamId] || 0;
          let newScore = currentScore + delta;
          if (!allowNegative) newScore = Math.max(0, newScore); 
          return {
              ...prev,
              [challengeId]: { ...(prev[challengeId] || {}), [teamId]: newScore }
          };
      });
  };

  const handleResolveChallenge = async (challenge) => {
      const rawScores = rawScoresInputs[challenge.id] || {};
      const finalScores = {};
      eventTeams.forEach(t => { finalScores[t.id] = rawScores[t.id] || 0; });

      if(!confirm("Vuoi confermare e assegnare i punti?")) return;

      try {
          await resolveEventChallenge(challenge.id, finalScores, challenge.pointsScheme);
          setSelectedLiveChallenge(null); 
      } catch (e) { alert("Errore tecnico: " + e.message); }
  };

  const handleRevertChallenge = async (challengeId) => {
      if(!confirm("Vuoi riaprire questa sfida? I punti verranno sottratti alle squadre e ricalcolati da zero.")) return;
      try { await revertEventChallenge(challengeId); } catch(e) { alert("Errore: " + e.message); }
  };

  const handleApplyManualPoints = async () => {
      const scores = rawScoresInputs['manual'] || {};
      const hasPoints = Object.values(scores).some(val => val !== 0);
      if (!hasPoints) {
          alert("Non hai inserito nessun punteggio.");
          return;
      }
      if(!confirm("Confermi di voler applicare questi punti manuali?")) return;
      try {
          await addManualPointsToEventTeams(scores);
          setRawScoresInputs(prev => ({ ...prev, manual: {} })); 
          setSelectedLiveChallenge(null);
      } catch (e) { alert("Errore: " + e.message); }
  };

  const handleLogout = async () => {
      try {
          await signOut(auth);
          window.location.reload(); 
      } catch (error) { console.error("Errore:", error); }
  };

  const assignedMatricoleIds = eventTeams.flatMap(t => t.members || []);
  const availableMatricole = allMatricole.filter(m => !assignedMatricoleIds.includes(m.id));

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white"><Loader2 className="animate-spin" size={48} /></div>;

  if (!user) {
      return (
          <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
              <div className="text-center mb-8">
                  <div className="bg-[#B41F35]/20 p-4 rounded-2xl inline-block mb-4 border border-[#B41F35]/30 shadow-lg">
                      <Settings size={48} className="text-[#B41F35]" />
                  </div>
                  <h1 className="text-3xl font-black text-white tracking-wide">Gestione Punti</h1>
                  <p className="text-gray-400 font-medium mt-2 uppercase tracking-widest text-xs">Accesso Riservato</p>
              </div>
              <div className="w-full max-w-md">
                  <Login />
              </div>
          </div>
      );
  }

  if (!userData || userData.role !== 'super-admin') {
      return (
          <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
              <ShieldAlert size={80} className="text-red-500 mb-6 drop-shadow-lg" />
              <h1 className="text-3xl font-black text-white mb-2">Accesso Negato</h1>
              <p className="text-gray-400 mb-8 max-w-sm">Sembra che tu non abbia i permessi necessari. Questa area è riservata esclusivamente alla Regia dell'evento.</p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                  <button onClick={handleLogout} className="flex-1 bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 border border-gray-700">
                      <LogOut size={18} /> Esci dall'Account
                  </button>
                  <a href="https://matricolata.it" className="flex-1 bg-[#B41F35] text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-[#90192a] transition-all flex items-center justify-center">
                      Torna all'App
                  </a>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6 font-sans">
        <header className="flex flex-col md:flex-row items-center justify-between border-b border-gray-800 pb-4 mb-6 max-w-7xl mx-auto gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="bg-[#B41F35] p-2 rounded-lg"><Settings size={24} /></div>
                <div>
                    <h1 className="text-xl font-bold leading-tight">Gestione Punti</h1>
                  
                </div>
            </div>

            <div className="flex bg-gray-800 p-1 rounded-xl w-full md:w-auto border border-gray-700">
                <button onClick={() => { setActiveView('setup'); setSelectedLiveChallenge(null); }} className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeView === 'setup' ? 'bg-gray-700 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}><Wrench size={16}/> SETUP</button>
                <button onClick={() => { setActiveView('live'); setSelectedLiveChallenge(null); }} className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeView === 'live' ? 'bg-[#B41F35] text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}><MonitorPlay size={16}/> LIVE</button>
            </div>

            <div className="flex items-center gap-4 hidden md:flex">
                <div className="text-right">
                    <span className="text-sm font-bold block">{userData.displayName}</span>
                    <span className="text-[10px] text-red-400 uppercase font-black tracking-widest">Super Admin</span>
                </div>
                <img src={userData.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${userData.id}&backgroundColor=fecaca`} className="w-10 h-10 rounded-full border-2 border-gray-700 bg-red-100 object-cover" />
                <button onClick={handleLogout} className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-red-500"><LogOut size={18} /></button>
            </div>
        </header>

        <main className="max-w-7xl mx-auto pb-20">
            
            {/* ========================================== */}
            {/* VISTA 1: SETUP */}
            {/* ========================================== */}
            {activeView === 'setup' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4">
                    
                    {/* SETUP SQUADRE */}
                    <div className="space-y-6">
                        {/* Box Creazione Squadra: layout verticale per far spazio su mobile */}
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users className="text-[#B41F35]" /> Crea Squadre Serata</h2>
                            <form onSubmit={handleCreateTeam} className="flex flex-col gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Nome Squadra</label>
                                    <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-[#B41F35]" placeholder="Es. Squadra Rossa" required />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                                    <div className="flex gap-2">
                                        {COLORS.map(c => (
                                            <button key={c.name} type="button" onClick={() => setNewTeamColor(c)} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-2 transition-all ${c.class} ${newTeamColor.name === c.name ? 'ring-4 ring-white border-transparent scale-110' : 'border-gray-800 opacity-50'}`} title={c.name}/>
                                        ))}
                                    </div>
                                    <button type="submit" className="bg-[#B41F35] text-white py-3 px-6 rounded-xl font-bold w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg hover:bg-[#90192a] transition-all">
                                        <Plus size={20} /> CREA SQUADRA
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* LISTA SQUADRE E MODIFICA NOME */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {eventTeams.map(team => {
                                const teamMembers = allMatricole.filter(m => (team.members || []).includes(m.id));
                                return (
                                    <div key={team.id} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                                        <div className={`${team.colorClass} p-3 flex justify-between items-center`}>
                                            
                                            {/* SEZIONE EDIT NOME */}
                                            {editingTeamId === team.id ? (
                                                <div className="flex items-center gap-2 flex-1 mr-2">
                                                    <input 
                                                        type="text" 
                                                        value={editingTeamName} 
                                                        onChange={(e) => setEditingTeamName(e.target.value)}
                                                        className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded px-2 py-1 outline-none font-bold"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveTeamName(team.id)} className="bg-white/20 hover:bg-white/40 p-1.5 rounded transition-colors text-white">
                                                        <Check size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <h3 className="font-black text-white text-lg truncate flex-1">{team.name}</h3>
                                            )}

                                            <div className="flex items-center gap-1">
                                                {editingTeamId !== team.id && (
                                                    <button onClick={() => handleStartEditTeam(team)} className="text-white/70 hover:text-white bg-black/20 p-1.5 rounded-lg transition-colors">
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDeleteTeam(team.id)} className="text-white/70 hover:text-white bg-black/20 p-1.5 rounded-lg transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4 flex-1 flex flex-col">
                                            <span className="text-xs font-bold text-gray-400 mb-2">MEMBRI ({teamMembers.length})</span>
                                            <div className="space-y-2 mb-4 flex-1">
                                                {teamMembers.map(m => (
                                                    <div key={m.id} className="flex justify-between items-center bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                                                        <span className="text-sm font-bold truncate pr-2">{m.displayName}</span>
                                                        <button onClick={() => removeMatricolaFromEventTeam(team.id, m.id)} className="text-gray-500 hover:text-red-400"><UserMinus size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <select 
                                                className="w-full bg-gray-900 border border-gray-700 text-sm text-gray-300 rounded-xl p-2 outline-none" value=""
                                                onChange={(e) => assignMatricolaToEventTeam(team.id, e.target.value)}
                                            >
                                                <option value="" disabled>+ Aggiungi Matricola...</option>
                                                {availableMatricole.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* SETUP SFIDE */}
                    <div className="space-y-6">
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Swords className="text-yellow-500" /> Crea Sfide</h2>
                            <form onSubmit={handleCreateChallenge} className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Titolo Sfida</label>
                                    <input type="text" value={newChallengeTitle} onChange={e => setNewChallengeTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-yellow-500" placeholder="Es. Indovina la Canzone" required />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-yellow-500 font-bold uppercase mb-1 block">Pt. 1° Posto</label>
                                        <input type="number" value={p1} onChange={e => setP1(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 font-black text-center outline-none" required/>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Pt. 2° Posto</label>
                                        <input type="number" value={p2} onChange={e => setP2(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 font-black text-center outline-none" required/>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-orange-400 font-bold uppercase mb-1 block">Pt. 3° Posto</label>
                                        <input type="number" value={p3} onChange={e => setP3(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 font-black text-center outline-none" required/>
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-yellow-500 text-gray-900 p-3 rounded-xl font-black hover:bg-yellow-400 flex items-center justify-center gap-2">
                                    <Plus size={20} /> CREA SFIDA
                                </button>
                            </form>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-2">Riepilogo Sfide Create</h3>
                            {eventChallenges.map(challenge => (
                                <div key={challenge.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            {challenge.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500"/> : <Swords size={16} className="text-yellow-500"/>}
                                            {challenge.title}
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">Premi: {challenge.pointsScheme.join(' / ')} pt</p>
                                    </div>
                                    <button onClick={() => {if(confirm('Eliminare sfida?')) deleteEventChallenge(challenge.id)}} className="text-gray-500 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* VISTA 2: LIVE                               */}
            {/* ========================================== */}
            {activeView === 'live' && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    
                    {!selectedLiveChallenge && (
                        <div className="space-y-8">
                            {/* SCOREBOARD SQUADRE GIGANTE */}
                            <div>
                                <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> PUNTEGGI IN TEMPO REALE
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {eventTeams.map(team => (
                                        <div key={team.id} className={`${team.colorClass} rounded-3xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden`}>
                                            <div className="absolute -right-4 -bottom-4 opacity-20"><Trophy size={120} /></div>
                                            <h3 className="font-black text-white text-2xl drop-shadow-md z-10">{team.name}</h3>
                                            <div className="mt-6 z-10">
                                                <span className="text-6xl font-black text-white drop-shadow-lg">{team.score}</span>
                                                <span className="text-lg font-bold text-white/80 ml-2 uppercase tracking-widest">Pt</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* LISTA SFIDE CLICCABILI */}
                            <div>
                                <h2 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2"><Swords size={20}/> Scegli la sfida da giocare</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    
                                    <button 
                                        onClick={() => setSelectedLiveChallenge({ id: 'manual', title: 'Aggiunta Manuale', isManual: true })}
                                        className="p-5 rounded-2xl border-2 border-dashed text-left transition-all relative overflow-hidden group bg-gray-900 border-gray-600 hover:border-white hover:shadow-xl cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-white flex items-center gap-2"><Wrench size={18}/> Punti Manuali</h3>
                                            <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" />
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Aggiungi o rimuovi punti liberamente alle squadre (es. penalità o bonus).</p>
                                    </button>

                                    {eventChallenges.map(challenge => {
                                        const isActive = challenge.status === 'active';
                                        return (
                                            <button 
                                                key={challenge.id}
                                                onClick={() => isActive ? setSelectedLiveChallenge(challenge) : null}
                                                className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                                                    isActive ? 'bg-gray-800 border-gray-600 hover:border-yellow-500 hover:shadow-xl cursor-pointer' : 'bg-gray-900/50 border-gray-800 cursor-default opacity-80'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-bold text-lg text-white pr-2">{challenge.title}</h3>
                                                    {isActive ? (
                                                        <ChevronRight className="text-gray-500 group-hover:text-yellow-500 transition-colors shrink-0" />
                                                    ) : (
                                                        <div onClick={(e) => { e.stopPropagation(); handleRevertChallenge(challenge.id); }} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-xs px-2 py-1 rounded text-white transition-all z-10 cursor-pointer shrink-0">
                                                            <RotateCcw size={12}/> Modifica
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">1° {challenge.pointsScheme[0]} / 2° {challenge.pointsScheme[1]} / 3° {challenge.pointsScheme[2]}</p>
                                                
                                                {!isActive && challenge.finalResults && (
                                                    <div className="mt-3 pt-3 border-t border-gray-800">
                                                        <span className="text-[10px] uppercase font-bold text-green-500 block mb-1">Risultati Finali</span>
                                                        {challenge.finalResults.map(res => {
                                                            const team = eventTeams.find(t => t.id === res.teamId);
                                                            return (
                                                                <div key={res.teamId} className="flex justify-between text-xs text-gray-400">
                                                                    <span>{res.rank}° {team?.name}</span>
                                                                    <span className="font-bold text-white">+{res.earnedPoints}</span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SCHERMATA DEDICATA ALLA SFIDA */}
                    {selectedLiveChallenge && (
                        <div className="bg-gray-800 border border-gray-700 rounded-3xl p-4 md:p-6 shadow-2xl max-w-3xl mx-auto animate-in zoom-in-95 duration-200">
                            
                            <button onClick={() => setSelectedLiveChallenge(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 font-bold uppercase text-xs tracking-wider">
                                <ArrowLeft size={16}/> Torna indietro
                            </button>

                            <div className="mb-6 md:mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 leading-tight">
                                    {selectedLiveChallenge.isManual ? <Wrench className="text-gray-400 w-8 h-8 shrink-0"/> : <Swords className="text-yellow-500 w-8 h-8 shrink-0"/>}
                                    {selectedLiveChallenge.title}
                                </h2>
                                
                                {selectedLiveChallenge.isManual ? (
                                    <p className="text-xs md:text-sm text-gray-400 mt-3 font-medium bg-gray-900 inline-block px-3 py-1 rounded-lg border border-gray-700">
                                        Modifica liberamente i punteggi (puoi anche scendere sotto zero).
                                    </p>
                                ) : (
                                    <p className="text-xs md:text-sm text-gray-400 mt-3 font-medium bg-gray-900 inline-block px-3 py-1 rounded-lg border border-gray-700">
                                        Punti in palio: <span className="text-yellow-500 font-bold">{selectedLiveChallenge.pointsScheme[0]}</span> / <span className="text-gray-300 font-bold">{selectedLiveChallenge.pointsScheme[1]}</span> / <span className="text-orange-400 font-bold">{selectedLiveChallenge.pointsScheme[2]}</span>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4 mb-8">
                                {eventTeams.map(team => {
                                    const currentScore = (rawScoresInputs[selectedLiveChallenge.id] || {})[team.id] || 0;
                                    const step = selectedLiveChallenge.isManual ? 10 : 1;
                                    const allowNegative = selectedLiveChallenge.isManual;

                                    return (
                                        <div key={team.id} className="flex flex-col sm:flex-row justify-between items-center bg-gray-900 border border-gray-700 p-4 sm:p-5 rounded-2xl shadow-inner gap-4">
                                            
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-start">
                                                <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full shadow-md shrink-0 ${team.colorClass}`}></div>
                                                <h3 className="font-bold text-xl md:text-2xl text-white truncate">{team.name}</h3>
                                            </div>
                                            
                                            <div className="flex items-center justify-between w-full sm:w-auto bg-gray-800 sm:bg-transparent p-2 sm:p-0 rounded-2xl border sm:border-0 border-gray-700">
                                                <button 
                                                    onClick={() => incrementScore(selectedLiveChallenge.id, team.id, -step, allowNegative)}
                                                    className="w-16 h-16 sm:w-14 sm:h-14 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl flex items-center justify-center shadow-md transition-all active:scale-90"
                                                >
                                                    <Minus size={32}/>
                                                </button>
                                                
                                                <div className="w-20 md:w-24 text-center">
                                                    <span className={`text-4xl md:text-5xl font-black ${currentScore < 0 ? 'text-red-500' : 'text-white'}`}>{currentScore > 0 && selectedLiveChallenge.isManual ? '+' : ''}{currentScore}</span>
                                                </div>

                                                <button 
                                                    onClick={() => incrementScore(selectedLiveChallenge.id, team.id, step, allowNegative)}
                                                    className="w-16 h-16 sm:w-14 sm:h-14 bg-[#B41F35] hover:bg-[#90192a] text-white rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90"
                                                >
                                                    <Plus size={32} strokeWidth={3}/>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {selectedLiveChallenge.isManual ? (
                                <button 
                                    onClick={handleApplyManualPoints}
                                    className="w-full bg-[#B41F35] text-white p-5 rounded-2xl font-black text-xl hover:bg-[#90192a] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                                >
                                    <Settings size={28} />
                                    APPLICA PUNTI
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleResolveChallenge(selectedLiveChallenge)}
                                    className="w-full bg-green-600 text-white p-5 rounded-2xl font-black text-xl hover:bg-green-500 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                                >
                                    <Trophy size={28} />
                                    CALCOLA CLASSIFICA
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </main>
    </div>
  );
}
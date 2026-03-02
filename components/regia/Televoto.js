import { useState, useEffect } from 'react';
import { Plus, Play, Trash2, EyeOff, CheckCircle2, Trophy, Users, XCircle, Star, Undo2, RefreshCw, AlertTriangle, ListOrdered, Radio, User } from 'lucide-react';
import {
    addEventPerformance,
    deleteEventPerformance,
    startEventPerformance,
    openLiveVoting,
    completeEventPerformance,
    cancelLivePerformance,
    assignAllPerformancePoints,
    propagateSinglePerformanceToFanta,
    rollbackFantaPropagation,
    repeatPerformanceTelvoto,
    getEventTeams,
    fullResetTelvoto
} from '@/lib/firebase';

export default function Televoto({ eventPerformances, allMatricole, liveVotingData }) {
    // --- STATI TABS E FORM ---
    const [activeTab, setActiveTab] = useState('scaletta'); // 'scaletta' | 'live'
    const [isTeamMode, setIsTeamMode] = useState(false);
    const [useManualName, setUseManualName] = useState(false);
    const [selectedMatricolaForVoting, setSelectedMatricolaForVoting] = useState('');
    const [manualMatricolaName, setManualMatricolaName] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [votingTheme, setVotingTheme] = useState('');

    // Fetch squadre da Firestore
    const [allTeams, setAllTeams] = useState([]);
    useEffect(() => {
        getEventTeams().then(setAllTeams).catch(console.error);
    }, []);

    // ─── DATI DERIVATI (Code e Stati) ─────────────────────────────────────────
    const pendingPerfs = eventPerformances.filter(p => p.status === 'pending');
    const activePerfs = eventPerformances.filter(p => p.status === 'active');
    const completedPerfs = eventPerformances.filter(p => p.status === 'completed');

    const allDone = eventPerformances.length > 0 && pendingPerfs.length === 0 && activePerfs.length === 0;
    const currentLiveSum = Object.values(liveVotingData?.votes || {}).reduce((a, b) => a + Number(b), 0);
    const currentVotersCount = liveVotingData?.votes ? Object.keys(liveVotingData.votes).length : 0;

    // ─── HELPER SQUADRE (Colore e Nome) ──────────────────────────────────────
    const getTeamInfoForPerformance = (perf) => {
        if (perf.isTeam && perf.teamId) {
            const team = allTeams.find(t => t.id === perf.teamId);
            return team || { name: 'Sconosciuta', colorClass: 'text-gray-400' };
        } else if (perf.matricolaId) {
            const team = allTeams.find(t => (t.members || []).includes(perf.matricolaId));
            return team || { name: 'Senza Squadra', colorClass: 'text-gray-400' };
        }
        return { name: 'Manuale', colorClass: 'text-gray-400' };
    };

    // ─── FILTRO MATRICOLE GIÀ IN SCALETTA ────────────────────────────────────
    const usedMatricoleIds = eventPerformances.map(p => p.matricolaId).filter(Boolean);
    const availableMatricole = allMatricole.filter(m => !usedMatricoleIds.includes(m.id));

    // ─── RAGGRUPPAMENTO ESIBIZIONI CONCLUSE PER SQUADRA ──────────────────────
    const groupedCompleted = allTeams.map(team => {
        const teamPerfs = completedPerfs.filter(p =>
            (p.isTeam && p.teamId === team.id) ||
            (!p.isTeam && p.matricolaId && team.members?.includes(p.matricolaId))
        );
        return { ...team, performances: teamPerfs };
    });

    const unassignedCompleted = completedPerfs.filter(p => {
        if (p.isTeam) return !allTeams.find(t => t.id === p.teamId);
        if (p.matricolaId) return !allTeams.find(t => t.members?.includes(p.matricolaId));
        return true; 
    });

    // ─── HANDLERS ────────────────────────────────────────────────────────────
    const handleAddToLineup = async (e) => {
        e.preventDefault();
        if (!votingTheme.trim()) { alert("Inserisci il tema dell'esibizione."); return; }
        try {
            if (isTeamMode) {
                if (!selectedTeamId) { alert("Seleziona una squadra."); return; }
                const team = allTeams.find(t => t.id === selectedTeamId);
                await addEventPerformance(selectedTeamId, team.name, votingTheme, true);
                setSelectedTeamId('');
            } else if (useManualName) {
                if (!manualMatricolaName.trim()) { alert("Inserisci il nome manuale."); return; }
                await addEventPerformance("manual_" + Date.now(), manualMatricolaName, votingTheme, false);
                setManualMatricolaName('');
            } else {
                if (!selectedMatricolaForVoting) { alert("Seleziona una matricola."); return; }
                const matricola = allMatricole.find(m => m.id === selectedMatricolaForVoting);
                await addEventPerformance(selectedMatricolaForVoting, matricola.displayName, votingTheme, false);
                setSelectedMatricolaForVoting('');
            }
            setVotingTheme('');
            alert("Aggiunto in scaletta!");
        } catch (err) { alert(err.message); }
    };

    const handleDeletePerformance = async (perfId) => {
        if (!window.confirm("Rimuovere questa esibizione dalla scaletta?")) return;
        try { await deleteEventPerformance(perfId); } catch (e) { alert(e.message); }
    };

    const handleStartPerformance = async (perfId) => {
        if (!window.confirm("Iniziare questa esibizione e mostrare il popup?")) return;
        try { 
            await startEventPerformance(perfId); 
            setActiveTab('live'); 
        } catch (e) { alert(e.message); }
    };

    const handleOpenLiveVoting = async () => {
        if (!window.confirm("Aprire le votazioni al pubblico?")) return;
        try { await openLiveVoting(); } catch (e) { alert(e.message); }
    };

    const handleCloseLivePerformance = async () => {
        if (!liveVotingData?.performanceId) return;
        if (!window.confirm("Chiudere il televoto e salvare la SOMMA totale?")) return;
        try { await completeEventPerformance(liveVotingData.performanceId); } catch (e) { alert(e.message); }
    };

    const handleCancelLivePerformance = async () => {
        if (!window.confirm("ANNULLA l'esibizione in corso? I voti verranno scartati e l'esibizione tornerà in coda.")) return;
        try { await cancelLivePerformance(); } catch (e) { alert(e.message); }
    };

    const handlePropagateToFanta = async (perf) => {
        const msg = perf.isTeam
            ? `Propagare ${perf.totalScore} pt al Fanta di TUTTI i membri della squadra "${perf.matricolaName}"?`
            : `Propagare ${perf.totalScore} pt al Fanta di "${perf.matricolaName}"?`;
        if (!window.confirm(msg)) return;
        try {
            await propagateSinglePerformanceToFanta(perf.id);
            alert("✅ Punti propagati!");
        } catch (e) { alert(e.message); }
    };

    const handleRollbackFanta = async (perf) => {
        if (!window.confirm("Annullare la propagazione Fanta? I punti verranno sottratti.")) return;
        try { await rollbackFantaPropagation(perf.id); alert("✅ Rollback completato."); } catch (e) { alert(e.message); }
    };

    const handleRepeatTelvoto = async (perf) => {
        const warn = perf.fantaPropagated ? `\n⚠️ I punti Fanta già propagati verranno sottratti automaticamente.` : '';
        if (!window.confirm(`Ripetere il televoto per "${perf.matricolaName}"? Il punteggio attuale verrà azzerato.${warn}`)) return;
        try { await repeatPerformanceTelvoto(perf.id); } catch (e) { alert(e.message); }
    };

    const handleFinalPointsAssignment = async () => {
        if (!window.confirm("Assegnare i punti finali alle squadre? Operazione irreversibile.")) return;
        try {
            const count = await assignAllPerformancePoints();
            alert(`✅ Punti assegnati a ${count} squadre!`);
        } catch (e) { alert(e.message); }
    };

    const handleFullReset = async () => {
        if (!window.confirm("⚠️ RESET TOTALE TELEVOTO ⚠️\nSottrae punti Fanta, rimuove feed, azzera tabellone e rimette in coda. Sei sicuro?")) return;
        try {
            const count = await fullResetTelvoto();
            alert(`✅ Reset completato. ${count} esibizioni rimesse in coda.`);
        } catch (e) { alert(e.message); }
    };

    // ─── RENDER HELPER AZIONI FANTA ─────────────────────────────────────────
    const renderActionButtons = (perf) => (
        <div className="flex items-center gap-2 justify-end">
            {perf.fantaPropagated ? (
                <div className="flex flex-col items-center gap-1">
                    <span className="text-green-500 text-[10px] font-black uppercase tracking-wide">✓ Inviato</span>
                    <button onClick={() => handleRollbackFanta(perf)} className="text-[10px] text-red-400 hover:underline flex items-center gap-1"><Undo2 size={9} /> Annulla</button>
                </div>
            ) : (
                <button onClick={() => handlePropagateToFanta(perf)} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase hover:bg-yellow-500 hover:text-black transition-all flex items-center gap-1.5">
                    <Star size={10} /> Propaga
                </button>
            )}
            {perf.pointsAssigned ? (
                <span className="text-gray-700 text-[10px] font-bold uppercase ml-2">Bloccato</span>
            ) : (
                <button onClick={() => handleRepeatTelvoto(perf)} className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1.5 ml-2">
                    <RefreshCw size={10} /> Ripeti
                </button>
            )}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            
            {/* ══ NAVIGAZIONE TABS ══ */}
            <div className="flex bg-gray-900 p-1.5 rounded-2xl border border-gray-700/50 shadow-lg mb-8 max-w-sm mx-auto">
                <button
                    onClick={() => setActiveTab('scaletta')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'scaletta' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <ListOrdered size={18} /> CREA SCALETTA
                </button>
                <button
                    onClick={() => setActiveTab('live')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'live' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Radio size={18} className={activeTab === 'live' && liveVotingData?.isActive ? 'animate-pulse' : ''} /> GESTIONE LIVE
                </button>
            </div>

            {/* =========================================================
                TAB 1: CREA SCALETTA
               ========================================================= */}
            {activeTab === 'scaletta' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
                    
                    {/* FORM DI AGGIUNTA */}
                    <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-8 shadow-xl">
                        <h2 className="text-2xl font-black mb-6 text-white flex items-center gap-2">
                            <Plus className="text-purple-500" /> Aggiungi Esibizione
                        </h2>

                        <div className="flex p-1 bg-gray-900 rounded-2xl mb-6">
                            <button type="button" onClick={() => { setIsTeamMode(false); setUseManualName(false); }} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${!isTeamMode ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                <User size={16}/> Matricola Singola
                            </button>
                            <button type="button" onClick={() => { setIsTeamMode(true); setUseManualName(false); }} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${isTeamMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                <Users size={16}/> Intera Squadra
                            </button>
                        </div>

                        <form onSubmit={handleAddToLineup} className="space-y-5">
                            {isTeamMode ? (
                                <div>
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2 block">Seleziona Squadra</label>
                                    <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required>
                                        <option value="" disabled>Scegli...</option>
                                        {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">Seleziona Matricola</label>
                                        <button type="button" onClick={() => setUseManualName(!useManualName)} className="text-[10px] text-purple-400 font-black uppercase hover:underline bg-purple-500/10 px-2 py-1 rounded-lg">
                                            {useManualName ? "Usa menu a tendina" : "Digita nome a mano"}
                                        </button>
                                    </div>
                                    {!useManualName ? (
                                        <select value={selectedMatricolaForVoting} onChange={(e) => setSelectedMatricolaForVoting(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" required>
                                            <option value="" disabled>Scegli (nascosti chi è già in lista)...</option>
                                            {availableMatricole.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                                        </select>
                                    ) : (
                                        <input type="text" value={manualMatricolaName} onChange={(e) => setManualMatricolaName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" placeholder="Nome e Cognome..." required/>
                                    )}
                                    {!useManualName && availableMatricole.length === 0 && (
                                        <p className="text-xs text-orange-400 mt-2 font-medium">Tutte le matricole sono state inserite in scaletta!</p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">Tema Esibizione</label>
                                <input type="text" value={votingTheme} onChange={(e) => setVotingTheme(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" placeholder="Es. Canto, Imitazione..." required/>
                            </div>

                            <button type="submit" className={`w-full text-white py-4 rounded-xl font-black text-lg shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 ${isTeamMode ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/50'}`}>
                                <Plus size={20} /> METTI IN CODA
                            </button>
                        </form>
                    </div>

                    {/* RIEPILOGO SCALETTA (Solo Pending) */}
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 md:p-8 flex flex-col">
                        <h2 className="text-xl font-black mb-4 text-gray-300 flex items-center gap-2">
                            <ListOrdered className="text-gray-500" /> Ordine di uscita (Da Esibirsi)
                        </h2>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {pendingPerfs.map((perf, index) => {
                                const teamInfo = getTeamInfoForPerformance(perf);
                                return (
                                <div key={perf.id} className="bg-gray-800 p-4 rounded-2xl flex items-center justify-between border border-gray-700">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-gray-900 w-8 h-8 rounded-full flex items-center justify-center font-black text-gray-500 border border-gray-700">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase border border-current/20 ${teamInfo.colorClass}`}>
                                                    {perf.isTeam ? 'SQUADRA' : teamInfo.name}
                                                </span>
                                                <span className="font-bold text-white leading-none">{perf.isTeam ? perf.matricolaName.replace("SQUADRA: ", "") : perf.matricolaName}</span>
                                            </div>
                                            <span className="text-xs text-gray-400 italic block mt-1">{perf.theme}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeletePerformance(perf.id)} className="p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )})}
                            {pendingPerfs.length === 0 && (
                                <div className="text-center text-gray-500 py-10 font-medium">
                                    Nessuna esibizione in coda. <br/>Aggiungila dal form qui accanto.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
                TAB 2: GESTIONE LIVE E TABELLONI
               ========================================================= */}
            {activeTab === 'live' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    
                    {/* DASHBOARD LIVE (In Cima) */}
                    {liveVotingData?.isActive && (
                        <div className="bg-gray-900 border-2 border-red-600 rounded-3xl p-6 md:p-8 shadow-[0_0_80px_rgba(220,38,38,0.15)]">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="text-center md:text-left">
                                    <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-flex items-center gap-1 animate-pulse">
                                        <Radio size={12}/> LIVE ORA
                                    </span>
                                    {liveVotingData.isTeam && <span className="ml-2 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-flex items-center">SQUADRA</span>}
                                    <h3 className="text-4xl md:text-5xl font-black text-white mt-1">
                                        {liveVotingData.isTeam ? liveVotingData.matricolaName.replace("SQUADRA: ", "") : liveVotingData.matricolaName}
                                    </h3>
                                    <p className="text-gray-400 text-lg mt-1 italic">{liveVotingData.theme}</p>
                                </div>

                                <div className="flex flex-col gap-3 min-w-[240px]">
                                    {!liveVotingData.votingOpen ? (
                                        <button onClick={handleOpenLiveVoting} className="w-full bg-green-500 text-white px-8 py-4 rounded-2xl font-black text-xl hover:bg-green-400 transition-all shadow-lg shadow-green-900/50">
                                            APRI TELEVOTO
                                        </button>
                                    ) : (
                                        <div className="w-full bg-green-500/10 border border-green-500 text-green-400 px-6 py-4 rounded-2xl font-black text-xl text-center shadow-inner">
                                            VOTAZIONI APERTE!
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={handleCancelLivePerformance} className="flex-1 bg-gray-800 text-gray-300 px-4 py-3 rounded-xl font-bold text-sm hover:bg-gray-700 transition-all flex items-center justify-center gap-1">
                                            <XCircle size={16} /> Annulla
                                        </button>
                                        <button onClick={handleCloseLivePerformance} className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-red-500 transition-all flex items-center justify-center gap-1">
                                            <CheckCircle2 size={16} /> Chiudi & Salva
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-8 items-center bg-black/30 p-6 rounded-3xl border border-gray-800">
                                    <div className="text-center">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Votanti</p>
                                        <p className="text-4xl font-black text-gray-300">{currentVotersCount}</p>
                                    </div>
                                    <div className="h-16 w-[1px] bg-gray-700" />
                                    <div className="text-center">
                                        <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1">SOMMA VOTI</p>
                                        <p className="text-6xl font-black text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                                            {currentLiveSum}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CODA DI ATTESA RAPIDA (Da far partire) */}
                    {pendingPerfs.length > 0 && !liveVotingData?.isActive && (
                        <div>
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
                                <Play size={16} /> Prossime in scaletta
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {pendingPerfs.map(perf => {
                                    const teamInfo = getTeamInfoForPerformance(perf);
                                    return (
                                    <div key={perf.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col justify-between group hover:border-green-500/50 transition-all">
                                        <div className="mb-4">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase border border-current/20 ${teamInfo.colorClass}`}>
                                                {perf.isTeam ? 'SQUADRA' : teamInfo.name}
                                            </span>
                                            <h3 className="font-bold text-white mt-1 leading-tight">{perf.isTeam ? perf.matricolaName.replace("SQUADRA: ", "") : perf.matricolaName}</h3>
                                            <p className="text-[11px] text-gray-400 italic mt-0.5">{perf.theme}</p>
                                        </div>
                                        <button onClick={() => handleStartPerformance(perf.id)} className="w-full bg-green-600/20 text-green-400 border border-green-600/30 py-2 rounded-xl font-bold text-sm hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                            <Play size={14} /> INIZIA
                                        </button>
                                    </div>
                                )})}
                            </div>
                        </div>
                    )}

                    <hr className="border-gray-800" />

                    {/* TABELLONI SQUADRE CONCLUSE */}
                    <div>
                        <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                            <CheckCircle2 className="text-green-500" /> Esibizioni Concluse
                        </h2>

                        {groupedCompleted.map(team => {
                            if (team.performances.length === 0) return null;
                            return (
                                <div key={team.id} className="mb-8 bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-lg">
                                    <div className={`p-4 border-b border-gray-800 bg-gray-800/50 ${team.colorClass}`}>
                                        <h3 className="font-black text-lg flex items-center gap-2 uppercase tracking-wide">
                                            {team.name}
                                        </h3>
                                    </div>
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-900/80 border-b border-gray-800">
                                            <tr>
                                                <th className="p-3 pl-4 text-[10px] font-black text-gray-500 uppercase w-1/3">Esibizione</th>
                                                <th className="p-3 text-[10px] font-black text-gray-500 uppercase text-center w-1/6">Votanti</th>
                                                <th className="p-3 text-[10px] font-black text-gray-500 uppercase text-center w-1/6">Somma Voti</th>
                                                <th className="p-3 pr-4 text-[10px] font-black text-gray-500 uppercase text-right">Azioni Fanta</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {team.performances.map(perf => (
                                                <tr key={perf.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                                    <td className="p-3 pl-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-white text-sm">{perf.isTeam ? perf.matricolaName.replace("SQUADRA: ", "") : perf.matricolaName}</span>
                                                            <span className="text-xs text-gray-500 italic flex items-center gap-1">
                                                                {perf.isTeam && <span className="bg-blue-600/20 text-blue-400 text-[8px] font-black px-1 rounded uppercase">SQD</span>}
                                                                {perf.theme}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center text-gray-400 text-sm">{perf.votersCount}</td>
                                                    <td className="p-3 text-center font-black text-xl text-purple-400">{perf.totalScore}</td>
                                                    <td className="p-3 pr-4">
                                                        {renderActionButtons(perf)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}

                        {/* TABELLA SENZA SQUADRA / MANUALI */}
                        {unassignedCompleted.length > 0 && (
                            <div className="mb-8 bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-lg">
                                <div className="p-4 border-b border-gray-800 bg-gray-800/50">
                                    <h3 className="font-black text-lg text-gray-400 flex items-center gap-2 uppercase tracking-wide">
                                        Ospiti / Senza Squadra
                                    </h3>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900/80 border-b border-gray-800">
                                        <tr>
                                            <th className="p-3 pl-4 text-[10px] font-black text-gray-500 uppercase w-1/3">Esibizione</th>
                                            <th className="p-3 text-[10px] font-black text-gray-500 uppercase text-center w-1/6">Votanti</th>
                                            <th className="p-3 text-[10px] font-black text-gray-500 uppercase text-center w-1/6">Somma Voti</th>
                                            <th className="p-3 pr-4 text-[10px] font-black text-gray-500 uppercase text-right">Azioni Fanta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unassignedCompleted.map(perf => (
                                            <tr key={perf.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                                <td className="p-3 pl-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white text-sm">{perf.matricolaName}</span>
                                                        <span className="text-xs text-gray-500 italic">{perf.theme}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center text-gray-400 text-sm">{perf.votersCount}</td>
                                                <td className="p-3 text-center font-black text-xl text-gray-300">{perf.totalScore}</td>
                                                <td className="p-3 pr-4">
                                                    {renderActionButtons(perf)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {completedPerfs.length === 0 && (
                            <div className="text-center py-12 text-gray-600 font-bold border-2 border-dashed border-gray-800 rounded-3xl">
                                Nessun'esibizione ancora terminata.
                            </div>
                        )}
                    </div>

                    {/* BOTTONE FINALE PROPAGA CLASSIFICA */}
                    {allDone ? (
                        <div className="pt-6">
                            <button onClick={handleFinalPointsAssignment} className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white p-8 rounded-3xl font-black text-2xl shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-4 group">
                                <Trophy size={48} className="group-hover:rotate-12 transition-transform" />
                                PROPAGA CLASSIFICA SQUADRE
                            </button>
                            <p className="text-center text-gray-500 mt-3 text-sm">
                                Calcola la <span className="text-yellow-500 font-bold">media</span> delle esibizioni singole e la somma alle esibizioni di squadra.
                            </p>
                        </div>
                    ) : completedPerfs.length > 0 ? (
                        <div className="mt-8 p-6 border-2 border-dashed border-gray-800 rounded-3xl text-center text-gray-600 font-bold text-sm">
                            ⏳ "Propaga Classifica" sarà disponibile quando la scaletta sarà vuota.
                        </div>
                    ) : null}

                </div>
            )}

            {/* RESET TOTALE (Sempre in fondo, piccolino per sicurezza) */}
            {eventPerformances.length > 0 && (
                <div className="pt-12 pb-4">
                    <button onClick={handleFullReset} className="mx-auto bg-transparent border border-red-900/30 text-red-500/50 hover:bg-red-900/20 hover:text-red-400 px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2">
                        <AlertTriangle size={14} /> Reset Totale Database Televoto
                    </button>
                </div>
            )}

        </div>
    );
}
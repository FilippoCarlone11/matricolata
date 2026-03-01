import { useState, useEffect } from 'react';
import { Plus, Play, Trash2, EyeOff, CheckCircle2, Trophy, Users, XCircle, Star, Undo2, RefreshCw, AlertTriangle } from 'lucide-react';
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
    const [selectedMatricolaForVoting, setSelectedMatricolaForVoting] = useState('');
    const [manualMatricolaName, setManualMatricolaName] = useState('');
    const [useManualName, setUseManualName] = useState(false);
    const [votingTheme, setVotingTheme] = useState('');
    const [isTeamMode, setIsTeamMode] = useState(false);
    const [selectedTeamId, setSelectedTeamId] = useState('');

    // Fetch squadre da Firestore
    const [allTeams, setAllTeams] = useState([]);
    useEffect(() => {
        getEventTeams().then(setAllTeams).catch(console.error);
    }, []);

    // ─── Dati derivati ───────────────────────────────────────────────────────
    const pendingPerfs   = eventPerformances.filter(p => p.status === 'pending');
    const activePerfs    = eventPerformances.filter(p => p.status === 'active');
    const completedPerfs = eventPerformances.filter(p => p.status === 'completed');

    // "Propaga Classifica" appare solo quando nessuna esibizione è pending o active
    const allDone = eventPerformances.length > 0 && pendingPerfs.length === 0 && activePerfs.length === 0;

    const currentLiveSum     = Object.values(liveVotingData?.votes || {}).reduce((a, b) => a + Number(b), 0);
    const currentVotersCount = liveVotingData?.votes ? Object.keys(liveVotingData.votes).length : 0;

    // Helper per trovare i dati estetici (colore e nome) della squadra associata a un'esibizione
    const getTeamInfoForPerformance = (perf) => {
        if (perf.isTeam && perf.teamId) {
            const team = allTeams.find(t => t.id === perf.teamId);
            return team || { name: 'Sconosciuta', colorClass: 'text-gray-400', bgClass: 'bg-gray-600/20' };
        } else if (perf.matricolaId) {
            // Cerca la squadra di cui fa parte la matricola
            const team = allTeams.find(t => (t.members || []).includes(perf.matricolaId));
            return team || { name: 'Senza Squadra', colorClass: 'text-gray-400', bgClass: 'bg-gray-600/20' };
        }
        return { name: 'Manuale', colorClass: 'text-gray-400', bgClass: 'bg-gray-600/20' };
    };


    // ─── Handlers ────────────────────────────────────────────────────────────
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
        } catch (err) { alert(err.message); }
    };

    const handleDeletePerformance = async (perfId) => {
        if (!window.confirm("Rimuovere questa esibizione dalla scaletta?")) return;
        try { await deleteEventPerformance(perfId); } catch (e) { alert(e.message); }
    };

    const handleStartPerformance = async (perfId) => {
        if (!window.confirm("Iniziare questa esibizione e mostrare il popup?")) return;
        try { await startEventPerformance(perfId); } catch (e) { alert(e.message); }
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

    // Propaga al Fanta: crea request approved nel feed
    const handlePropagateToFanta = async (perf) => {
        const msg = perf.isTeam
            ? `Propagare ${perf.totalScore} pt al Fanta di TUTTI i membri della squadra "${perf.matricolaName}"?\nOgni membro riceverà ${perf.totalScore} pt individualmente.`
            : `Propagare ${perf.totalScore} pt al Fanta di "${perf.matricolaName}"?\nApparirà nel feed come bonus approvato.`;
        if (!window.confirm(msg)) return;
        try {
            await propagateSinglePerformanceToFanta(perf.id);
            alert(perf.isTeam ? "✅ Punti propagati a tutti i membri della squadra!" : "✅ Punti propagati al Fanta!");
        } catch (e) { alert(e.message); }
    };

    // Rollback Fanta: sottrae punti e cancella il documento requests dal feed
    const handleRollbackFanta = async (perf) => {
        const msg = perf.isTeam
            ? `Annullare la propagazione Fanta per la squadra "${perf.matricolaName}"?\nVerranno sottratti ${perf.totalScore} pt da ogni membro e la voce verrà rimossa dal feed.`
            : `Annullare la propagazione Fanta per "${perf.matricolaName}"?\nVerranno sottratti ${perf.totalScore} pt e la voce verrà rimossa dal feed.`;
        if (!window.confirm(msg)) return;
        try {
            await rollbackFantaPropagation(perf.id);
            alert("✅ Rollback completato.");
        } catch (e) { alert(e.message); }
    };

    // Ripeti televoto: rollback Fanta automatico se necessario + rimette in pending
    const handleRepeatTelvoto = async (perf) => {
        const warn = perf.fantaPropagated
            ? `\n⚠️ I ${perf.totalScore} pt Fanta già propagati verranno sottratti automaticamente e rimossi dal feed.`
            : '';
        if (!window.confirm(`Ripetere il televoto per "${perf.matricolaName}"?\nIl punteggio attuale (${perf.totalScore} pt) verrà azzerato.${warn}`)) return;
        try { await repeatPerformanceTelvoto(perf.id); } catch (e) { alert(e.message); }
    };

    // Propaga classifica: media delle somme per squadra (solo quando allDone)
    const handleFinalPointsAssignment = async () => {
        if (!window.confirm("Assegnare i punti finali alle squadre?\nViene calcolata la MEDIA delle SOMME di ogni membro.\nOperazione irreversibile. Confermi?")) return;
        try {
            const count = await assignAllPerformancePoints();
            alert(`✅ Punti assegnati a ${count} squadre!`);
        } catch (e) { alert(e.message); }
    };

    // Reset totale: rollback Fanta + classifica + rimette tutto in pending
    const handleFullReset = async () => {
        if (!window.confirm(
            "⚠️ RESET TOTALE TELEVOTO ⚠️\n\n" +
            "Questa operazione:\n" +
            "• Sottrae i punti Fanta da tutti gli utenti propagati\n" +
            "• Rimuove tutte le voci dal feed (requests)\n" +
            "• Sottrae i punti classifica dalle squadre\n" +
            "• Rimette TUTTE le esibizioni in coda\n\n" +
            "Sei assolutamente sicuro?"
        )) return;
        try {
            const count = await fullResetTelvoto();
            alert(`✅ Reset completato. ${count} esibizioni rimesse in coda.`);
        } catch (e) { alert(e.message); }
    };

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 max-w-6xl mx-auto space-y-8">

            {/* ══ RIGA SUPERIORE: Aggiungi + Coda ══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* SEZIONE A: Aggiungi in Scaletta */}
                <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 shadow-xl h-fit">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Plus className="text-purple-500" /> Aggiungi in Scaletta
                    </h2>

                    {/* Toggle Matricola / Squadra */}
                    <div className="flex items-center gap-1 mb-4 bg-gray-900 rounded-2xl p-1">
                        <button
                            type="button"
                            onClick={() => { setIsTeamMode(false); setUseManualName(false); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-black transition-all ${!isTeamMode ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            👤 Matricola
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsTeamMode(true); setUseManualName(false); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-black transition-all ${isTeamMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Users size={14} /> Squadra
                        </button>
                    </div>

                    <form onSubmit={handleAddToLineup} className="space-y-4">
                        {isTeamMode ? (
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">Squadra</label>
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                                    required
                                >
                                    <option value="" disabled>Seleziona squadra...</option>
                                    {allTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Matricola</label>
                                    <button
                                        type="button"
                                        onClick={() => setUseManualName(!useManualName)}
                                        className="text-[10px] text-purple-400 font-black uppercase hover:underline"
                                    >
                                        {useManualName ? "Usa Lista" : "Inserisci a Mano"}
                                    </button>
                                </div>
                                {!useManualName ? (
                                    <select
                                        value={selectedMatricolaForVoting}
                                        onChange={(e) => setSelectedMatricolaForVoting(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-purple-500"
                                        required
                                    >
                                        <option value="" disabled>Seleziona dalla lista...</option>
                                        {allMatricole.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={manualMatricolaName}
                                        onChange={(e) => setManualMatricolaName(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-purple-500"
                                        placeholder="Nome e Cognome..."
                                    />
                                )}
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Tema Esibizione</label>
                            <input
                                type="text"
                                value={votingTheme}
                                onChange={(e) => setVotingTheme(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-purple-500"
                                placeholder="Es. Imitazione Gerry"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className={`w-full text-white py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-lg ${isTeamMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}
                        >
                            <Plus size={18} /> AGGIUNGI IN CODA
                        </button>
                    </form>
                </div>

                {/* SEZIONE B: In Coda (pending) */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 px-2">
                        <Play className="text-green-500" /> Prossime Esibizioni
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingPerfs.map(perf => {
                            const teamInfo = getTeamInfoForPerformance(perf);
                            
                            // Estrai il nome nudo e crudo rimuovendo "SQUADRA: " se presente per non appesantire la UI
                            const displayName = perf.isTeam ? perf.matricolaName.replace("SQUADRA: ", "") : perf.matricolaName;

                            return (
                            <div key={perf.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg group hover:border-green-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="mb-1 flex items-center gap-1.5">
                                            {/* Badge colorato della squadra */}
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${teamInfo.bgClass || 'bg-gray-700'} ${teamInfo.colorClass}`}>
                                                {perf.isTeam ? 'SQUADRA' : teamInfo.name}
                                            </span>
                                        </div>
                                        <h3 className={`font-black text-lg group-hover:text-green-400 transition-colors text-white `}>
                                            {displayName}
                                        </h3>
                                        <p className="text-xs text-gray-400 italic mt-0.5">{perf.theme}</p>
                                    </div>
                                    <button onClick={() => handleDeletePerformance(perf.id)} className="text-gray-600 hover:text-red-500 p-1 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleStartPerformance(perf.id)}
                                    className="w-full bg-green-600/20 text-green-400 border border-green-600/30 py-2 rounded-xl font-bold text-sm hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    <Play size={14} /> INIZIA ESIBIZIONE
                                </button>
                            </div>
                        )})}
                        {pendingPerfs.length === 0 && (
                            <div className="col-span-2 py-10 border-2 border-dashed border-gray-800 rounded-3xl flex items-center justify-center text-gray-600 font-bold">
                                La coda è vuota
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══ DASHBOARD LIVE ══ */}
            {liveVotingData?.isActive && (
                <div className="bg-gray-900 border-2 border-purple-500 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(168,85,247,0.15)]">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                        <div className="text-center md:text-left">
                            <span className="bg-purple-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block animate-pulse">LIVE ORA</span>
                            {liveVotingData.isTeam && (
                                <span className="ml-2 bg-blue-600/30 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">SQUADRA</span>
                            )}
                            <h3 className="text-4xl font-black text-white">
                                {liveVotingData.isTeam ? liveVotingData.matricolaName.replace("SQUADRA: ", "") : liveVotingData.matricolaName}
                            </h3>
                            <p className="text-gray-400 italic">{liveVotingData.theme}</p>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[220px]">
                            {!liveVotingData.votingOpen ? (
                                <button onClick={handleOpenLiveVoting} className="bg-green-500 text-white px-8 py-3 rounded-2xl font-black text-lg hover:bg-green-400 transition-all">
                                    APRI TELEVOTO
                                </button>
                            ) : (
                                <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-6 py-3 rounded-2xl font-black text-lg text-center">
                                    VOTAZIONI APERTE!
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelLivePerformance}
                                    className="flex-1 bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl font-black text-sm hover:bg-gray-600 transition-all flex items-center justify-center gap-1"
                                >
                                    <XCircle size={14} /> ANNULLA
                                </button>
                                <button
                                    onClick={handleCloseLivePerformance}
                                    className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-red-500 transition-all flex items-center justify-center gap-1"
                                >
                                    <EyeOff size={14} /> CHIUDI E SALVA
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-6 items-center">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Votanti</p>
                                <p className="text-4xl font-black text-white">{currentVotersCount}</p>
                            </div>
                            <div className="h-12 w-[2px] bg-gray-800" />
                            <div className="text-center">
                                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">SOMMA VOTI</p>
                                <p className="text-6xl font-black text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                                    {currentLiveSum}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ ESIBIZIONI CONCLUSE ══ */}
            <div className="space-y-4">
                <h2 className="text-sm font-black flex items-center gap-2 px-2 text-gray-400 uppercase tracking-widest">
                    <CheckCircle2 size={18} className="text-gray-500" /> Esibizioni Concluse
                </h2>

                <div className="bg-gray-800 border border-gray-700 rounded-3xl overflow-hidden shadow-xl">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 border-b border-gray-700">
                            <tr>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase">Squadra</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase">Esibizione</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase">Tema</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase text-right">Votanti</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase text-right">Somma</th>
                                {/* Due colonne azione pulite */}
                                <th className="p-4 text-xs font-black text-gray-500 uppercase text-center">Propaga Fanta</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase text-center">Ripeti Televoto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedPerfs.map(perf => {
                                const teamInfo = getTeamInfoForPerformance(perf);
                                const displayName = perf.isTeam ? perf.matricolaName.replace("SQUADRA: ", "") : perf.matricolaName;

                                return (
                                <tr key={perf.id} className="border-b border-gray-700/50 hover:bg-white/5 transition-colors">
                                    
                                    {/* Squadra (Badge Colorato) */}
                                    <td className="p-4">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase border border-current/20 ${teamInfo.colorClass}`}>
                                            {teamInfo.name}
                                        </span>
                                    </td>

                                    {/* Nome + badge tipo */}
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {perf.isTeam
                                                ? <span className="bg-blue-600/20 text-blue-400 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">SQD</span>
                                                : <span className="bg-purple-600/20 text-purple-400 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">MAT</span>
                                            }
                                            <span className={`font-bold ${perf.isTeam ? teamInfo.colorClass : 'text-white'}`}>
                                                {displayName}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="p-4 text-sm text-gray-400 italic">{perf.theme}</td>
                                    <td className="p-4 text-right text-gray-400 text-sm">{perf.votersCount ?? '—'}</td>
                                    <td className="p-4 text-right font-black text-xl text-purple-400">{perf.totalScore}</td>

                                    {/* ── PROPAGA FANTA ──
                                        Matricole: totalScore → utente singolo
                                        Squadre: totalScore → ogni membro della squadra
                                        In entrambi i casi: 1 documento requests nel feed */}
                                    <td className="p-4 text-center">
                                        {perf.fantaPropagated ? (
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className="bg-green-500/10 text-green-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide">✓ Inviato</span>
                                                <button
                                                    onClick={() => handleRollbackFanta(perf)}
                                                    className="text-[10px] text-red-400/60 hover:text-red-400 flex items-center gap-1 font-bold uppercase transition-colors"
                                                >
                                                    <Undo2 size={9} /> Annulla
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handlePropagateToFanta(perf)}
                                                className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase hover:bg-yellow-500 hover:text-black transition-all flex items-center gap-1.5 mx-auto"
                                            >
                                                <Star size={10} /> {perf.isTeam ? 'Propaga Membri' : 'Propaga'}
                                            </button>
                                        )}
                                    </td>

                                    {/* ── RIPETI TELEVOTO ──
                                        Disponibile sempre, tranne se i punti classifica sono già stati assegnati. */}
                                    <td className="p-4 text-center">
                                        {perf.pointsAssigned ? (
                                            <span className="text-gray-700 text-[10px] font-bold uppercase">Bloccato</span>
                                        ) : (
                                            <button
                                                onClick={() => handleRepeatTelvoto(perf)}
                                                className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1.5 mx-auto"
                                            >
                                                <RefreshCw size={10} /> Ripeti
                                            </button>
                                        )}
                                    </td>

                                </tr>
                            )})}
                            {completedPerfs.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-10 text-center text-gray-600 font-bold italic">
                                        Nessuna esibizione ancora terminata
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══ PROPAGA CLASSIFICA ══
                Appare SOLO quando tutte le esibizioni sono completed (nessuna pending/active).
                Calcola la MEDIA delle SOMME per squadra su event_teams (campo score, array members). */}
            {allDone ? (
                <div className="pt-6">
                    <button
                        onClick={handleFinalPointsAssignment}
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white p-8 rounded-3xl font-black text-2xl shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-4 group"
                    >
                        <Trophy size={48} className="group-hover:rotate-12 transition-transform" />
                        PROPAGA CLASSIFICA
                    </button>
                    <p className="text-center text-gray-500 mt-3 text-sm">
                        Calcola la <span className="text-yellow-500 font-bold">media</span> delle somme dei membri di ogni squadra e aggiorna il campo <code className="text-gray-400">score</code> in <code className="text-gray-400">event_teams</code>.
                        <br />
                        <span className="text-gray-600 text-xs">Es. Matricola A = 100 pt · Matricola B = 200 pt → Squadra riceve <strong className="text-white">150 pt</strong></span>
                    </p>
                </div>
            ) : completedPerfs.length > 0 ? (
                <div className="pt-4 py-6 border-2 border-dashed border-gray-800 rounded-3xl text-center text-gray-600 font-bold text-sm">
                    ⏳ "Propaga Classifica" sarà disponibile quando tutte le esibizioni saranno completate
                    {pendingPerfs.length > 0 && ` · ancora ${pendingPerfs.length} in coda`}
                    {activePerfs.length > 0 && ` · 1 live in corso`}
                </div>
            ) : null}

            {/* ══ RESET TOTALE ══
                Sempre visibile. Rollback completo di Fanta + classifica + rimette tutto in pending. */}
            {eventPerformances.length > 0 && (
                <div className="pt-2 pb-8">
                    <button
                        onClick={handleFullReset}
                        className="w-full bg-gray-900 border-2 border-red-900/50 text-red-500/70 hover:border-red-500 hover:text-red-400 p-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 group"
                    >
                        <AlertTriangle size={18} className="group-hover:animate-pulse" />
                        RESET TOTALE TELEVOTO — Rollback completo di Fanta e Classifica
                    </button>
                </div>
            )}

        </div>
    );
}
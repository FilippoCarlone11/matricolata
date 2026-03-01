import { useState } from 'react';
import { Trophy, Swords, Wrench, ChevronRight, RotateCcw, CheckCircle2, Minus, Plus, Settings, Loader2, Send, ArrowLeft } from 'lucide-react';
import { resolveEventChallenge, revertEventChallenge, addManualPointsToEventTeams, propagateChallengeToFanta, revertFantaPropagation } from '@/lib/firebase';

export default function LiveSfide({ eventTeams, eventChallenges }) {
    const [selectedLiveChallenge, setSelectedLiveChallenge] = useState(null);
    const [rawScoresInputs, setRawScoresInputs] = useState({});
    const [isPropagating, setIsPropagating] = useState(false);

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

        if (!window.confirm("Vuoi confermare e assegnare i punti?")) return;

        try {
            await resolveEventChallenge(challenge.id, finalScores, challenge.pointsScheme);
            setSelectedLiveChallenge(null);
        } catch (e) { alert("Errore tecnico: " + e.message); }
    };

    const handleRevertChallenge = async (challengeId) => {
        if (!window.confirm("Vuoi riaprire questa sfida? I punti verranno sottratti alle squadre e ricalcolati da zero.")) return;
        try { await revertEventChallenge(challengeId); } catch (e) { alert("Errore: " + e.message); }
    };

    const handlePropagateToFanta = async (challengeId) => {
        if (!window.confirm("ATTENZIONE: Verranno aggiunti +5 punti alle matricole della prima squadra e tolti -5 a quelle dell'ultima. Confermi?")) return;
        
        setIsPropagating(true);
        try {
            await propagateChallengeToFanta(challengeId);
            alert("Propagazione avvenuta con successo!");
        } catch (e) {
            alert("Errore durante la propagazione: " + e.message);
        } finally {
            setIsPropagating(false);
        }
    };
    
    const handleRevertPropagation = async (challengeId) => {
        if (!window.confirm("Vuoi annullare la propagazione? I punti verranno rimossi e i post cancellati dal feed.")) return;
        setIsPropagating(true);
        try {
            await revertFantaPropagation(challengeId);
            alert("Propagazione annullata!");
        } catch (e) {
            alert("Errore: " + e.message);
        } finally {
            setIsPropagating(false);
        }
    };

    const handleApplyManualPoints = async () => {
        const scores = rawScoresInputs['manual'] || {};
        const hasPoints = Object.values(scores).some(val => val !== 0);
        if (!hasPoints) {
            alert("Non hai inserito nessun punteggio.");
            return;
        }
        if (!window.confirm("Confermi di voler applicare questi punti manuali?")) return;
        try {
            await addManualPointsToEventTeams(scores);
            setRawScoresInputs(prev => ({ ...prev, manual: {} }));
            setSelectedLiveChallenge(null);
        } catch (e) { alert("Errore: " + e.message); }
    };

    return (
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
                        <h2 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2"><Swords size={20} /> Scegli la sfida da giocare</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                            <button
                                onClick={() => setSelectedLiveChallenge({ id: 'manual', title: 'Aggiunta Manuale', isManual: true })}
                                className="p-5 rounded-2xl border-2 border-dashed text-left transition-all relative overflow-hidden group bg-gray-900 border-gray-600 hover:border-white hover:shadow-xl cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-white flex items-center gap-2"><Wrench size={18} /> Punti Manuali</h3>
                                    <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Aggiungi o rimuovi punti liberamente alle squadre (es. penalità o bonus).</p>
                            </button>

                            {eventChallenges.map(challenge => {
                                const isActive = challenge.status === 'active';
                                return (
                                    <div
                                        key={challenge.id}
                                        className={`rounded-2xl border transition-all relative overflow-hidden flex flex-col ${isActive ? 'bg-gray-800 border-gray-600 hover:border-yellow-500 hover:shadow-xl cursor-pointer' : 'bg-gray-900/50 border-gray-800'}`}
                                    >
                                        {/* PARTE CLICCABILE DELLA CARD (Se attiva) */}
                                        <div 
                                            className="p-5 flex-1"
                                            onClick={() => isActive ? setSelectedLiveChallenge(challenge) : null}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className={`font-bold text-lg ${isActive ? 'text-white' : 'text-gray-400'} pr-2`}>{challenge.title}</h3>
                                                {isActive ? (
                                                    <ChevronRight className="text-gray-500 group-hover:text-yellow-500 transition-colors shrink-0" />
                                                ) : (
                                                    <div onClick={(e) => { e.stopPropagation(); handleRevertChallenge(challenge.id); }} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-xs px-2 py-1 rounded text-white transition-all z-10 cursor-pointer shrink-0">
                                                        <RotateCcw size={12} /> Modifica
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">1° {challenge.pointsScheme[0]} / 2° {challenge.pointsScheme[1]} / 3° {challenge.pointsScheme[2]}</p>

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
                                        </div>

                                        {/* SEZIONE PROPAGAZIONE FANTA (Solo per sfide completate) */}
                                        {!isActive && challenge.status === 'completed' && (
                                            <div className="bg-gray-800/80 p-3 border-t border-gray-700">
                                                {challenge.fantaPropagated ? (
                                                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-green-500">
                                                        <span className="flex items-center gap-1"><CheckCircle2 size={14}/> Propagati al Fanta</span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRevertPropagation(challenge.id); }} 
                                                            disabled={isPropagating} 
                                                            className="text-red-400 hover:text-red-300 bg-red-400/10 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                                        >
                                                            <RotateCcw size={12}/> Annulla
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handlePropagateToFanta(challenge.id); }}
                                                        disabled={isPropagating}
                                                        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 py-2 rounded-xl transition-all shadow-md"
                                                    >
                                                        {isPropagating ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                                                        Propaga al Fanta (+5/-5)
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* SCHERMATA DEDICATA ALLA SFIDA DA GIOCARE */}
            {selectedLiveChallenge && (
                <div className="bg-gray-800 border border-gray-700 rounded-3xl p-4 md:p-6 shadow-2xl max-w-3xl mx-auto animate-in zoom-in-95 duration-200">
                    <button onClick={() => setSelectedLiveChallenge(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 font-bold uppercase text-xs tracking-wider">
                        <ArrowLeft size={16} /> Torna indietro
                    </button>

                    <div className="mb-6 md:mb-8">
                        <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 leading-tight">
                            {selectedLiveChallenge.isManual ? <Wrench className="text-gray-400 w-8 h-8 shrink-0" /> : <Swords className="text-yellow-500 w-8 h-8 shrink-0" />}
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
                                            <Minus size={32} />
                                        </button>

                                        <div className="w-20 md:w-24 text-center">
                                            <span className={`text-4xl md:text-5xl font-black ${currentScore < 0 ? 'text-red-500' : 'text-white'}`}>{currentScore > 0 && selectedLiveChallenge.isManual ? '+' : ''}{currentScore}</span>
                                        </div>

                                        <button
                                            onClick={() => incrementScore(selectedLiveChallenge.id, team.id, step, allowNegative)}
                                            className="w-16 h-16 sm:w-14 sm:h-14 bg-[#B41F35] hover:bg-[#90192a] text-white rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90"
                                        >
                                            <Plus size={32} strokeWidth={3} />
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
    );
}
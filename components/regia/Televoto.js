import { useState } from 'react';
import { Plus, Play, Trash2, EyeOff, CheckCircle2, RotateCcw, Trophy } from 'lucide-react';
import { 
    addEventPerformance, 
    deleteEventPerformance, 
    resetEventPerformance, 
    startEventPerformance, 
    openLiveVoting, 
    completeEventPerformance, 
    assignAllPerformancePoints 
} from '@/lib/firebase';

export default function Televoto({ eventPerformances, allMatricole, liveVotingData }) {
    const [selectedMatricolaForVoting, setSelectedMatricolaForVoting] = useState('');
    const [manualMatricolaName, setManualMatricolaName] = useState('');
    const [useManualName, setUseManualName] = useState(false);
    const [votingTheme, setVotingTheme] = useState('');

    const handleAddToLineup = async (e) => {
        e.preventDefault();
        let name = "";
        let id = "";

        if (useManualName) {
            if (!manualMatricolaName.trim()) { alert("Inserisci il nome manuale."); return; }
            name = manualMatricolaName;
            id = "manual_" + Date.now();
        } else {
            if (!selectedMatricolaForVoting) { alert("Seleziona una matricola."); return; }
            const matricola = allMatricole.find(m => m.id === selectedMatricolaForVoting);
            name = matricola.displayName;
            id = selectedMatricolaForVoting;
        }

        if (!votingTheme.trim()) {
            alert("Inserisci il tema dell'esibizione.");
            return;
        }

        try {
            await addEventPerformance(id, name, votingTheme);
            setSelectedMatricolaForVoting('');
            setManualMatricolaName('');
            setVotingTheme('');
        } catch (e) { alert(e.message); }
    };

    const handleDeletePerformance = async (perfId) => {
        if (!window.confirm("Rimuovere questa esibizione dalla scaletta?")) return;
        try { await deleteEventPerformance(perfId); } catch (e) { alert(e.message); }
    };

    const handleResetPerformance = async (perfId) => {
        if (!window.confirm("Sei sicuro di voler resettare questa esibizione? Il punteggio attuale verrà eliminato e l'esibizione tornerà in coda come 'Da esibirsi'.")) return;
        try { await resetEventPerformance(perfId); } catch (e) { alert(e.message); }
    };

    const handleStartPerformance = async (perfId) => {
        if (!window.confirm("Vuoi iniziare questa esibizione e mostrare il popup?")) return;
        try { await startEventPerformance(perfId); }
        catch (e) { alert(e.message); }
    };

    const handleOpenLiveVoting = async () => {
        if (!window.confirm("Aprire le votazioni sul pubblico?")) return;
        try { await openLiveVoting(); } catch (e) { alert(e.message); }
    };

    const handleCloseLivePerformance = async () => {
        if (!liveVotingData?.performanceId) return;
        if (!window.confirm("Vuoi chiudere il televoto e salvare il punteggio totale (SOMMA)?")) return;
        try {
            await completeEventPerformance(liveVotingData.performanceId);
        } catch (e) { alert(e.message); }
    };

    const handleFinalPointsAssignment = async () => {
        if (!window.confirm("ATTENZIONE: Stai per assegnare tutti i punti accumulati durante i televoti alle rispettive squadre. Operazione eseguibile una sola volta per serata. Confermi?")) return;
        try {
            const count = await assignAllPerformancePoints();
            alert(`Successo! Punti assegnati a ${count} squadre.`);
        } catch (e) { alert(e.message); }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 max-w-6xl mx-auto space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SEZIONE A: AGGIUNTA IN SCALETTA */}
                <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 shadow-xl h-fit">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="text-purple-500" /> Aggiungi in Scaletta</h2>
                    <form onSubmit={handleAddToLineup} className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Matricola</label>
                            <button
                                type="button"
                                onClick={() => setUseManualName(!useManualName)}
                                className="text-[10px] text-purple-400 font-black uppercase hover:underline"
                            >
                                {useManualName ? "Usa Lista" : "Inserisci Nome a Mano"}
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
                                required
                            />
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
                        <button type="submit" className="w-full bg-purple-600 text-white py-3 rounded-xl font-black hover:bg-purple-500 transition-all flex items-center justify-center gap-2 shadow-lg">
                            <Plus size={18} /> AGGIUNGI IN CODA
                        </button>
                    </form>
                </div>

                {/* SEZIONE B: DA ESIBIRSI (PENDING) */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 px-2"><Play className="text-green-500" /> Prossime Esibizioni (In Coda)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {eventPerformances.filter(p => p.status === 'pending').map(perf => (
                            <div key={perf.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg group hover:border-green-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-black text-lg text-white group-hover:text-green-400 transition-colors">{perf.matricolaName}</h3>
                                        <p className="text-xs text-gray-400 italic">{perf.theme}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeletePerformance(perf.id)}
                                        className="text-gray-600 hover:text-red-500 p-1 transition-colors"
                                        title="Rimuovi"
                                    >
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
                        ))}
                        {eventPerformances.filter(p => p.status === 'pending').length === 0 && (
                            <div className="col-span-2 py-10 border-2 border-dashed border-gray-800 rounded-3xl flex flex-center justify-center text-gray-600 font-bold">La coda è vuota</div>
                        )}
                    </div>
                </div>
            </div>

            {/* DASHBOARD REAL-TIME (ACTIVE) */}
            {liveVotingData?.isActive && (
                <div className="bg-gray-900 border-2 border-purple-500 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(168,85,247,0.15)] relative overflow-hidden">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="text-center md:text-left">
                            <span className="bg-purple-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block animate-pulse">LIVE ORA</span>
                            <h3 className="text-4xl font-black text-white">{liveVotingData.matricolaName}</h3>
                            <p className="text-gray-400 font-medium italic">{liveVotingData.theme}</p>
                        </div>

                        <div className="flex gap-4">
                            {!liveVotingData.votingOpen ? (
                                <button onClick={handleOpenLiveVoting} className="bg-green-500 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-green-400 transition-all shadow-green-500/20">APRI TELEVOTO</button>
                            ) : (
                                <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-6 py-4 rounded-2xl font-black text-lg">VOTAZIONI APERTE!</div>
                            )}
                            <button onClick={handleCloseLivePerformance} className="bg-red-600 text-white px-6 py-4 rounded-2xl font-black hover:bg-red-500 transition-all flex items-center gap-2"><EyeOff size={20} /> CHIUDI</button>
                        </div>

                        <div className="flex gap-6 items-center">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Votanti</p>
                                <p className="text-4xl font-black text-white">{liveVotingData.votes ? Object.keys(liveVotingData.votes).length : 0}</p>
                            </div>
                            <div className="h-12 w-[2px] bg-gray-800"></div>
                            <div className="text-center">
                                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">SOMMA VOTI</p>
                                <p className="text-6xl font-black text-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                                    {Object.values(liveVotingData.votes || {}).reduce((a, b) => a + Number(b), 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SEZIONE C: GIÀ FATTE (COMPLETED) */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2 px-2 text-gray-400 uppercase tracking-widest text-sm"><CheckCircle2 className="text-gray-500" /> Esibizioni Concluse</h2>
                <div className="bg-gray-800 border border-gray-700 rounded-3xl overflow-hidden shadow-xl">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 border-b border-gray-700">
                            <tr>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase">Matricola</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase">Tema</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase text-right">Somma Punti</th>
                                <th className="p-4 text-xs font-black text-gray-500 uppercase text-center">Stato Punti</th>
                            </tr>
                        </thead>
                        <tbody>
                            {eventPerformances.filter(p => p.status === 'completed').map(perf => (
                                <tr key={perf.id} className="border-b border-gray-700/50 hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-white">{perf.matricolaName}</td>
                                    <td className="p-4 text-sm text-gray-400">{perf.theme}</td>
                                    <td className="p-4 text-right font-black text-xl text-purple-400">{perf.totalScore}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            {perf.pointsAssigned ? (
                                                <span className="bg-green-500/10 text-green-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">Assegnati</span>
                                            ) : (
                                                <>
                                                    <span className="bg-yellow-500/10 text-yellow-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">In attesa</span>
                                                    <button
                                                        onClick={() => handleResetPerformance(perf.id)}
                                                        className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 font-bold uppercase"
                                                    >
                                                        <RotateCcw size={10} /> Resetta
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {eventPerformances.filter(p => p.status === 'completed').length === 0 && (
                                <tr><td colSpan="4" className="p-10 text-center text-gray-600 font-bold italic">Nessun esibizione ancora terminata</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PULSANTE FINALE ASSEGNAZIONE */}
            <div className="pt-10">
                <button
                    onClick={handleFinalPointsAssignment}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white p-8 rounded-3xl font-black text-2xl shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-4 group"
                >
                    <Trophy size={48} className="group-hover:rotate-12 transition-transform" />
                    ASSEGNA TUTTI I PUNTI ALLE SQUADRE
                </button>
                <p className="text-center text-gray-500 mt-4 text-sm font-medium">Questa azione prenderà tutti i totali sopra elencati e li sommerà ai punteggi delle squadre dei relativi membri.</p>
            </div>
        </div>
    );
}
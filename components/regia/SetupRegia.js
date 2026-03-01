import { useState } from 'react';
import { Users, Swords, Plus, Trash2, Edit2, Check, CheckCircle2, UserMinus } from 'lucide-react';
import { createEventTeam, deleteEventTeam, updateEventTeamName, createEventChallenge, deleteEventChallenge } from '@/lib/firebase';

const COLORS = [
    { name: 'Rosso', class: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
    { name: 'Blu', class: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
    { name: 'Verde', class: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
    { name: 'Giallo', class: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-500' },
    { name: 'Viola', class: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
];

export default function SetupRegia({ eventTeams, allMatricole, eventChallenges, onAssignMatricola, onRemoveMatricola }) {
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamColor, setNewTeamColor] = useState(COLORS[0]);
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [editingTeamName, setEditingTeamName] = useState('');

    const [newChallengeTitle, setNewChallengeTitle] = useState('');
    const [p1, setP1] = useState(150);
    const [p2, setP2] = useState(100);
    const [p3, setP3] = useState(50);

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        if (!newTeamName.trim()) return;
        try { await createEventTeam(newTeamName, newTeamColor.class); setNewTeamName(''); }
        catch (err) { alert(err.message); }
    };

    const handleDeleteTeam = async (teamId) => {
        if (window.confirm("Sei sicuro di voler eliminare questa squadra della serata?")) {
             await deleteEventTeam(teamId);
        }
    };

    const handleStartEditTeam = (team) => {
        setEditingTeamId(team.id);
        setEditingTeamName(team.name);
    };

    const handleSaveTeamName = async (teamId) => {
        if (!editingTeamName.trim()) { setEditingTeamId(null); return; }
        try { await updateEventTeamName(teamId, editingTeamName); setEditingTeamId(null); }
        catch (error) { alert("Errore durante il salvataggio: " + error.message); }
    };

    const handleCreateChallenge = async (e) => {
        e.preventDefault();
        if (!newChallengeTitle.trim()) return;
        try {
            await createEventChallenge(newChallengeTitle, Number(p1), Number(p2), Number(p3));
            setNewChallengeTitle('');
        } catch (err) { alert(err.message); }
    };

    // Helper per le matricole non ancora assegnate (usato nella select)
    const assignedMatricoleIds = eventTeams.flatMap(t => t.members || []);
    const availableMatricole = allMatricole.filter(m => !assignedMatricoleIds.includes(m.id));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4">

            {/* SETUP SQUADRE */}
            <div className="space-y-6">
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
                                    <button key={c.name} type="button" onClick={() => setNewTeamColor(c)} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-2 transition-all ${c.class} ${newTeamColor.name === c.name ? 'ring-4 ring-white border-transparent scale-110' : 'border-gray-800 opacity-50'}`} title={c.name} />
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
                                                <button onClick={() => onRemoveMatricola(team.id, m.id)} className="text-gray-500 hover:text-red-400"><UserMinus size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 text-sm text-gray-300 rounded-xl p-2 outline-none" value=""
                                        onChange={(e) => onAssignMatricola(team.id, e.target.value)}
                                    >
                                        <option value="" disabled>+ Aggiungi...</option>
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
                                <input type="number" value={p1} onChange={e => setP1(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 font-black text-center outline-none" required />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Pt. 2° Posto</label>
                                <input type="number" value={p2} onChange={e => setP2(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 font-black text-center outline-none" required />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-orange-400 font-bold uppercase mb-1 block">Pt. 3° Posto</label>
                                <input type="number" value={p3} onChange={e => setP3(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 font-black text-center outline-none" required />
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
                                    {challenge.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500" /> : <Swords size={16} className="text-yellow-500" />}
                                    {challenge.title}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">Premi: {challenge.pointsScheme.join(' / ')} pt</p>
                            </div>
                            <button onClick={async () => {
                                if(window.confirm('Sei sicuro di voler eliminare questa sfida?')) {
                                    try { await deleteEventChallenge(challenge.id); } catch (e) { alert(e.message); }
                                }
                            }} className="text-gray-500 hover:text-red-500 p-2"><Trash2 size={18} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
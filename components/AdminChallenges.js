'use client';

import { useState, useEffect } from 'react';
import { createChallenge, getChallenges, deleteChallenge } from '@/lib/firebase';
import { Trash2, Plus, Zap, Eye, EyeOff } from 'lucide-react';

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [form, setForm] = useState({ titolo: '', punti: '', category: 'Altro', type: 'oneshot', hidden: false });
  const [loading, setLoading] = useState(true);

  // Filtro visivo per admin
  const [activeFilter, setActiveFilter] = useState('bonus_visible'); // bonus_visible, malus_visible, bonus_hidden, malus_hidden

  useEffect(() => { loadChallenges(); }, []);

  const loadChallenges = async () => {
    const data = await getChallenges();
    setChallenges(data);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.titolo || !form.punti) return;
    
    // Auto-detect visibility based on filter if creating from that tab
    let isHidden = form.hidden;
    if (activeFilter.includes('hidden')) isHidden = true;

    // Determine points sign based on active filter intent, or trust user input
    // Here we trust input but default new inputs appropriately could be cool.
    
    await createChallenge({ 
      ...form, 
      punti: parseInt(form.punti), 
      hidden: isHidden,
      icon: form.punti > 0 ? '🏆' : '⚠️'
    });
    setForm({ titolo: '', punti: '', category: 'Altro', type: 'oneshot', hidden: false });
    loadChallenges();
  };

  const handleDelete = async (id) => {
    if (confirm('Eliminare definitivamente?')) {
      await deleteChallenge(id);
      loadChallenges();
    }
  };

  // Helper per filtrare
  const getFilteredList = () => {
    return challenges.filter(c => {
      const isBonus = c.punti > 0;
      const isHidden = c.hidden === true;

      switch(activeFilter) {
        case 'bonus_visible': return isBonus && !isHidden;
        case 'malus_visible': return !isBonus && !isHidden;
        case 'bonus_hidden': return isBonus && isHidden;
        case 'malus_hidden': return !isBonus && isHidden;
        default: return true;
      }
    });
  };

  const filteredList = getFilteredList();

  const FilterButton = ({ id, label, icon: Icon, colorClass }) => (
    <button 
      onClick={() => setActiveFilter(id)}
      className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${activeFilter === id ? colorClass : 'bg-white border-gray-200 text-gray-400'}`}
    >
      <div className="flex items-center gap-1">
        <Icon size={16} /> 
        {id.includes('hidden') && <EyeOff size={12} className="opacity-50"/>}
      </div>
      <span className="text-[10px] uppercase font-bold">{label}</span>
    </button>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Zap className="text-blue-600" /> Gestione Bonus & Malus
      </h2>

      {/* FORM CREAZIONE RAPIDA */}
      <form onSubmit={handleCreate} className="bg-gray-100 p-4 rounded-xl mb-6 space-y-3">
        <div className="flex gap-2">
           <input 
             type="text" placeholder="Titolo (es: Vince a Briscola)" 
             value={form.titolo} onChange={e => setForm({...form, titolo: e.target.value})}
             className="flex-1 p-2 rounded-lg border text-sm"
           />
           <input 
             type="number" placeholder="Pt" 
             value={form.punti} onChange={e => setForm({...form, punti: e.target.value})}
             className="w-20 p-2 rounded-lg border text-sm"
           />
        </div>
        <div className="flex gap-2 items-center">
            <select 
                value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="p-2 rounded-lg border text-sm flex-1"
            >
                <option>Altro</option><option>Sport</option><option>Party</option><option>Skill</option>
            </select>
            <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={form.hidden} 
                    onChange={e => setForm({...form, hidden: e.target.checked})} 
                />
                <span className="text-xs font-bold flex items-center gap-1">
                    {form.hidden ? <EyeOff size={14}/> : <Eye size={14}/>} Nascosto
                </span>
            </label>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700">Crea</button>
        </div>
      </form>

      {/* FILTRI CATEGORIE */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <FilterButton id="bonus_visible" label="Bonus Visibili" icon={Plus} colorClass="bg-green-50 border-green-500 text-green-700" />
        <FilterButton id="malus_visible" label="Malus Visibili" icon={Trash2} colorClass="bg-red-50 border-red-500 text-red-700" />
        <FilterButton id="bonus_hidden" label="Bonus Nascosti" icon={EyeOff} colorClass="bg-gray-100 border-gray-500 text-gray-700" />
        <FilterButton id="malus_hidden" label="Malus Nascosti" icon={EyeOff} colorClass="bg-gray-800 border-gray-900 text-white" />
      </div>

      {/* LISTA */}
      <div className="space-y-2">
        {filteredList.map(c => (
          <div key={c.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
               <span className="text-xl">{c.icon}</span>
               <div>
                  <p className="font-bold text-sm text-gray-900 leading-tight">{c.titolo}</p>
                  <div className="flex gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 rounded ${c.punti > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.punti} pt
                      </span>
                      {c.hidden && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded flex items-center gap-1"><EyeOff size={10}/> Nascosto</span>}
                  </div>
               </div>
            </div>
            <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 p-2">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {filteredList.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Nessun elemento in questa categoria.</p>}
      </div>
    </div>
  );
}
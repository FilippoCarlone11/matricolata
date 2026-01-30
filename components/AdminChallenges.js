'use client';

import { useState, useEffect } from 'react';
import { createChallenge, getChallenges, deleteChallenge } from '@/lib/firebase';
import { Trash2, Plus, Zap, Eye, EyeOff, Smile } from 'lucide-react';

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [form, setForm] = useState({ titolo: '', punti: '', icon: '🏆', type: 'oneshot', hidden: false });
  
  // NUOVO STATO PER GLI ERRORI
  const [errors, setErrors] = useState({ titolo: false, punti: false });
  
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('bonus_visible'); 

  const PRESET_EMOJIS = [
    '🏆', '⚽', '🍺', '🍹', '🍕', '🧹', '💀', '💩', 
    '🤡', '🤮', '💋', '💊', '🧠', '👀', '💃', '🍆',
    '🦄', '📸', '🎤', '🎲', '⚠️', '⛔', '💸', '🆘'
  ];

  useEffect(() => { loadChallenges(); }, []);

  const loadChallenges = async () => {
    const data = await getChallenges();
    setChallenges(data);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    // 1. VALIDAZIONE
    const newErrors = {
        titolo: !form.titolo, // Vero se vuoto
        punti: !form.punti      // Vero se vuoto
    };

    // Se c'è almeno un errore...
    if (newErrors.titolo || newErrors.punti) {
        setErrors(newErrors); // Mostra il rosso
        return; // Ferma tutto
    }

    // Se arrivo qui, resetto gli errori
    setErrors({ titolo: false, punti: false });
    
    let isHidden = form.hidden;
    if (activeFilter.includes('hidden')) isHidden = true;

    await createChallenge({ 
      ...form, 
      punti: parseInt(form.punti), 
      hidden: isHidden,
      category: 'Custom' 
    });
    
    // Reset del form
    setForm({ titolo: '', punti: '', icon: '🏆', type: 'oneshot', hidden: false });
    loadChallenges();
  };

  const handleDelete = async (id) => {
    if (confirm('Eliminare definitivamente?')) {
      await deleteChallenge(id);
      loadChallenges();
    }
  };

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

      {/* FORM CREAZIONE */}
      <form onSubmit={handleCreate} className="bg-gray-100 p-4 rounded-xl mb-6 space-y-3 border border-gray-200 shadow-inner">
        
        {/* RIGA 1: Titolo e Punti */}
        <div className="flex gap-2">
           <input 
             type="text" 
             placeholder={errors.titolo ? "Titolo obbligatorio!" : "Titolo (es: Limone duro)"}
             value={form.titolo} 
             onChange={e => {
                 setForm({...form, titolo: e.target.value});
                 if(errors.titolo) setErrors({...errors, titolo: false}); // Rimuovi rosso mentre scrive
             }}
             className={`flex-1 p-2 rounded-lg border text-sm outline-none transition-all ${
                 errors.titolo 
                 ? 'border-red-500 ring-2 ring-red-200 bg-red-50 placeholder-red-400' 
                 : 'border-gray-300 focus:ring-2 focus:ring-blue-400'
             }`}
           />
           <input 
             type="number" 
             placeholder="Pt" 
             value={form.punti} 
             onChange={e => {
                 setForm({...form, punti: e.target.value});
                 if(errors.punti) setErrors({...errors, punti: false}); // Rimuovi rosso mentre scrive
             }}
             className={`w-20 p-2 rounded-lg border text-sm font-bold text-center outline-none transition-all ${
                 errors.punti 
                 ? 'border-red-500 ring-2 ring-red-200 bg-red-50 placeholder-red-400' 
                 : 'border-gray-300 focus:ring-2 focus:ring-blue-400'
             }`}
           />
        </div>

        {/* RIGA 2: Selezione Emoji */}
        <div>
            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Smile size={12}/> Scegli Icona</label>
            <div className="flex gap-2 items-center">
                <input 
                    type="text" 
                    maxLength={2}
                    value={form.icon}
                    onChange={(e) => setForm({...form, icon: e.target.value})}
                    className="w-12 h-12 text-2xl text-center border-2 border-blue-200 rounded-xl focus:border-blue-500 outline-none bg-white"
                />
                
                <div className="flex-1 flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                    {PRESET_EMOJIS.map(emoji => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setForm({...form, icon: emoji})}
                            className={`min-w-[40px] h-10 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === emoji ? 'bg-blue-600 text-white scale-110 shadow-md' : 'bg-white border hover:bg-gray-50'}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* RIGA 3: Controlli Extra e Submit */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors">
                <input 
                    type="checkbox" 
                    checked={form.hidden} 
                    onChange={e => setForm({...form, hidden: e.target.checked})} 
                    className="accent-purple-600"
                />
                <span className="text-xs font-bold flex items-center gap-1 text-gray-700">
                    {form.hidden ? <EyeOff size={14} className="text-purple-600"/> : <Eye size={14} className="text-gray-400"/>} 
                    {form.hidden ? 'Nascosto' : 'Visibile'}
                </span>
            </label>
            
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-lg flex items-center gap-2">
                <Plus size={16}/> Crea
            </button>
        </div>
      </form>

      {/* FILTRI CATEGORIE */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <FilterButton id="bonus_visible" label="Bonus" icon={Plus} colorClass="bg-green-50 border-green-500 text-green-700" />
        <FilterButton id="malus_visible" label="Malus" icon={Trash2} colorClass="bg-red-50 border-red-500 text-red-700" />
        <FilterButton id="bonus_hidden" label="Bonus Segreti" icon={EyeOff} colorClass="bg-gray-100 border-gray-500 text-gray-700" />
        <FilterButton id="malus_hidden" label="Malus Segreti" icon={EyeOff} colorClass="bg-gray-800 border-gray-900 text-white" />
      </div>

      {/* LISTA */}
      <div className="space-y-2">
        {filteredList.map(c => (
          <div key={c.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
               <span className="text-2xl w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full">{c.icon}</span>
               <div>
                  <p className="font-bold text-sm text-gray-900 leading-tight">{c.titolo}</p>
                  <div className="flex gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 rounded ${c.punti > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.punti > 0 ? '+' : ''}{c.punti} pt
                      </span>
                      {c.hidden && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded flex items-center gap-1"><EyeOff size={10}/> Nascosto</span>}
                  </div>
               </div>
            </div>
            <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 p-2 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {filteredList.length === 0 && <p className="text-center text-gray-400 text-sm py-8 bg-white rounded-xl border border-dashed">Nessun elemento qui.</p>}
      </div>
    </div>
  );
}
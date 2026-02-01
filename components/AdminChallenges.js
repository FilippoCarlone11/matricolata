'use client';

import { useState, useEffect } from 'react';
import { createChallenge, getChallenges, deleteChallenge } from '@/lib/firebase';
import { Trash2, Plus, Zap, Eye, EyeOff, Repeat, AlignLeft, AlertCircle } from 'lucide-react';

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  
  // STATO FORM
  const [form, setForm] = useState({ 
    titolo: '', 
    punti: '', 
    icon: '', 
    type: 'oneshot', 
    description: '', 
    hidden: false // Questo deve comandare, sempre.
  });
  
  const [errors, setErrors] = useState({ titolo: false, punti: false, icon: false });
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
    
    // VALIDAZIONE
    const newErrors = {
        titolo: !form.titolo,
        punti: !form.punti,
        icon: !form.icon 
    };

    if (newErrors.titolo || newErrors.punti || newErrors.icon) {
        setErrors(newErrors);
        return;
    }

    setErrors({ titolo: false, punti: false, icon: false });
    
    // --- FIX BUG ---
    // Prima c'era un controllo che sovrascriveva isHidden in base al filtro attivo.
    // L'abbiamo rimosso. Ora usiamo SOLO quello che l'utente ha scelto nel form.
    const isHidden = form.hidden;
    const finalPunti = parseInt(form.punti);
    const isMalus = finalPunti < 0;

    await createChallenge({ 
      ...form, 
      punti: finalPunti, 
      hidden: isHidden,
      category: 'Custom' 
    });
    
    // Reset del form
    setForm({ titolo: '', punti: '', icon: '', type: 'oneshot', description: '', hidden: false });
    
    // --- UX IMPROVEMENT ---
    // Spostiamo automaticamente il filtro per mostrare ciò che abbiamo appena creato
    if (isHidden) {
        setActiveFilter(isMalus ? 'malus_hidden' : 'bonus_hidden');
    } else {
        setActiveFilter(isMalus ? 'malus_visible' : 'bonus_visible');
    }

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
             placeholder={errors.titolo ? "Inserisci Titolo!" : "Titolo..."}
             value={form.titolo} 
             onChange={e => {
                 setForm({...form, titolo: e.target.value});
                 if(errors.titolo) setErrors({...errors, titolo: false});
             }}
             className={`flex-1 p-3 rounded-xl border text-sm outline-none transition-all font-bold ${
                 errors.titolo ? 'border-red-500 bg-red-50 placeholder-red-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-400'
             }`}
           />
           <input 
             type="number" 
             placeholder="Pt" 
             value={form.punti} 
             onChange={e => {
                 setForm({...form, punti: e.target.value});
                 if(errors.punti) setErrors({...errors, punti: false});
             }}
             className={`w-20 p-3 rounded-xl border text-sm font-black text-center outline-none ${
                 errors.punti ? 'border-red-500 bg-red-50 placeholder-red-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-400'
             }`}
           />
        </div>

        {/* RIGA 2: DESCRIZIONE */}
        <div className="relative">
            <AlignLeft size={16} className="absolute top-3 left-3 text-gray-400" />
            <textarea
                placeholder="Descrizione (opzionale)..."
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full p-2 pl-9 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-400 min-h-[50px] bg-white"
            />
        </div>

        {/* RIGA 3: TIPO + ICONA (Input Manuale) + VISIBILITÀ */}
        <div className="flex gap-2 items-center">
            
            {/* 3a. SWITCH TIPO */}
            <div className="flex bg-white rounded-xl border border-gray-300 p-1 flex-1">
                <button 
                    type="button" 
                    onClick={() => setForm({...form, type: 'oneshot'})}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all ${
                        form.type === 'oneshot' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'
                    }`}
                >
                    <Zap size={12}/> Speciale
                </button>
                <button 
                    type="button" 
                    onClick={() => setForm({...form, type: 'daily'})}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition-all ${
                        form.type === 'daily' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'
                    }`}
                >
                    <Repeat size={12}/> Giornaliero
                </button>
            </div>
                    
            {/* 3b. INPUT ICONA (MANUALE) */}
            <div className="relative w-14 h-[46px]">
                 <input 
                    type="text" 
                    maxLength={4} 
                    placeholder="😀"
                    value={form.icon}
                    onChange={(e) => {
                        setForm({...form, icon: e.target.value});
                        if(errors.icon) setErrors({...errors, icon: false});
                    }}
                    className={`w-full h-full text-2xl text-center border rounded-xl outline-none bg-white focus:ring-2 focus:ring-blue-400 transition-colors ${
                        errors.icon ? 'border-red-500 bg-red-50 placeholder-red-300' : 'border-gray-300'
                    }`}
                />
                {errors.icon && <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 border-2 border-white"><AlertCircle size={8} className="text-white"/></div>}
            </div>

            {/* 3c. VISIBILITÀ */}
            <label className={`cursor-pointer w-12 h-[46px] flex items-center justify-center rounded-xl border transition-all ${form.hidden ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                <input type="checkbox" checked={form.hidden} onChange={e => setForm({...form, hidden: e.target.checked})} className="hidden"/>
                {form.hidden ? <EyeOff size={20}/> : <Eye size={20}/>}
            </label>

        </div>
        {/* RIGA 4: EMOJI PICKER (Scorrevole) */}
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide pt-1">
            {PRESET_EMOJIS.map(emoji => (
                <button key={emoji} type="button" onClick={() => setForm({...form, icon: emoji})} className={`min-w-[36px] h-9 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === emoji ? 'bg-blue-600 text-white scale-110 shadow-md' : 'bg-white border hover:bg-gray-50'}`}>
                    {emoji}
                </button>
            ))}
        </div>

        {/* SUBMIT */}
        <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-black shadow-lg flex items-center justify-center gap-2 mt-2">
            <Plus size={18}/> AGGIUNGI BONUS
        </button>

      </form>

      {/* FILTRI */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        <FilterButton id="bonus_visible" label="Bonus" icon={Plus} colorClass="bg-green-50 border-green-500 text-green-700" />
        <FilterButton id="malus_visible" label="Malus" icon={Trash2} colorClass="bg-red-50 border-red-500 text-red-700" />
        <FilterButton id="bonus_hidden" label="Bonus Segreti" icon={EyeOff} colorClass="bg-gray-100 border-gray-500 text-gray-700" />
        <FilterButton id="malus_hidden" label="Malus Segreti" icon={EyeOff} colorClass="bg-gray-800 border-gray-900 text-white" />
      </div>

      {/* LISTA */}
      <div className="space-y-2 pb-20">
        {filteredList.map(c => (
          <div key={c.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
               <span className="text-2xl w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full">{c.icon}</span>
               <div>
                  <p className="font-bold text-sm text-gray-900 leading-tight">{c.titolo}</p>
                  <div className="flex gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 rounded ${c.punti > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.punti > 0 ? '+' : ''}{c.punti} pt
                      </span>
                      {c.type === 'daily' && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded font-bold flex items-center gap-1"><Repeat size={8}/> Giornaliero</span>}
                      {c.hidden && <span className="text-[10px] bg-gray-800 text-white px-1.5 rounded flex items-center gap-1"><EyeOff size={8}/> Nascosto</span>}
                  </div>
               </div>
            </div>
            <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={18} /></button>
          </div>
        ))}
        {filteredList.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-xs italic">
                Nessun elemento in questa categoria.
            </div>
        )}
      </div>
    </div>
  );
}
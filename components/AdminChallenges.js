'use client';

import { useState, useEffect } from 'react';
import { createChallenge, getChallenges, deleteChallenge as apiDeleteChallenge } from '@/lib/firebase'; // Assicurati di avere deleteChallenge in firebase.js
import { PlusCircle, Target, Trash2, List } from 'lucide-react';

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [formData, setFormData] = useState({ titolo: '', punti: 10, categoria: 'Easy', type: 'oneshot', icon: '🎯' });
  const [loading, setLoading] = useState(true);

  // Carica elenco sfide
  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    const data = await getChallenges();
    setChallenges(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titolo) return;
    try {
      await createChallenge({ ...formData, punti: parseInt(formData.punti) });
      alert('Sfida creata!');
      setFormData({ titolo: '', punti: 10, categoria: 'Easy', type: 'oneshot', icon: '🎯' });
      loadList(); // Ricarica la lista
    } catch (error) { alert('Errore: ' + error); }
  };

  const handleDelete = async (id) => {
    if(!confirm("Eliminare questa sfida?")) return;
    await apiDeleteChallenge(id); // Devi implementare questa in firebase.js (vedi punto 1)
    loadList();
  };

  return (
    <div className="space-y-8">
      
      {/* FORM CREAZIONE */}
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <PlusCircle className="text-blue-600" /> Crea Nuova Sfida
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input 
            type="text" placeholder="Titolo (es: Bevi Acqua)" className="w-full p-2 border rounded-lg"
            value={formData.titolo} onChange={e => setFormData({...formData, titolo: e.target.value})}
          />
          <div className="flex gap-2">
            <input type="number" className="w-1/3 p-2 border rounded-lg" value={formData.punti} onChange={e => setFormData({...formData, punti: e.target.value})} />
            <input type="text" className="w-1/3 p-2 border rounded-lg text-center" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} />
            <select className="w-1/3 p-2 border rounded-lg" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="oneshot">One-Shot</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Pubblica</button>
        </form>
      </div>

      {/* ELENCO SFIDE ATTIVE */}
      <div className="bg-white rounded-2xl shadow p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <List className="text-gray-600" /> Elenco Sfide Attive ({challenges.length})
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {challenges.map(c => (
            <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="font-bold text-sm text-gray-800">{c.titolo}</p>
                  <p className="text-xs text-gray-500">{c.category} • {c.type} • <span className="text-green-600 font-bold">+{c.punti} pt</span></p>
                </div>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-600 p-2"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
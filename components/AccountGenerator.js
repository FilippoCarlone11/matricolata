'use client';

import { useState } from 'react';
import { registerWithEmail } from '@/lib/firebase'; 
import { Users, Loader2 } from 'lucide-react';

export default function AccountGenerator() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const generateAccounts = async () => {
    if (!confirm("Stai per creare 10 account reali (m1@test.com ... m10@test.com). Continuare?")) return;
    
    setLoading(true);
    setLogs([]);
    const newLogs = [];
    const PASSWORD_STANDARD = "123456"; 

    for (let i = 1; i <= 10; i++) {
      const email = `m${i}@test.com`;
      const name = `Matricola ${i}`;
      const photo = `https://api.dicebear.com/9.x/notionists/svg?seed=Matricola${i}&backgroundColor=e5e7eb`;

      try {
        await registerWithEmail(name, email, PASSWORD_STANDARD);
        
        // Piccolo hack per dare tempo al DB di aggiornarsi
        await new Promise(r => setTimeout(r, 300));

        newLogs.push(`✅ Creato: ${email}`);
      } catch (error) {
        if (error.message.includes('email-already-in-use')) {
             newLogs.push(`⚠️ Esiste già: ${email}`);
        } else {
             newLogs.push(`❌ Errore ${i}: ${error.message}`);
        }
      }
      setLogs([...newLogs]);
    }

    setLoading(false);
    alert("Processo terminato! Controlla i log.");
  };

  return (
    // MODIFICA QUI: 'bottom-24' lo alza sopra la navbar, 'z-[100]' lo mette sopra a tutto
    <div className="fixed bottom-24 left-4 z-[100]">
      {!loading && (
          <button 
            onClick={generateAccounts}
            className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-2xl border-2 border-white transition-transform hover:scale-110 flex items-center gap-2 font-bold text-xs animate-bounce"
            title="Genera 10 Account Matricole"
          >
            <Users size={20} /> CREA 10 MATRICOLE
          </button>
      )}

      {loading && (
        <div className="bg-gray-900 text-white p-4 rounded-xl shadow-2xl w-64 text-xs font-mono mb-2">
            <h3 className="font-bold mb-2 flex items-center gap-2 text-yellow-400">
                <Loader2 className="animate-spin" size={14}/> Generazione in corso...
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
                {logs.map((log, idx) => (
                    <div key={idx} className={log.includes('❌') ? 'text-red-400' : (log.includes('⚠️') ? 'text-orange-300' : 'text-green-400')}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}
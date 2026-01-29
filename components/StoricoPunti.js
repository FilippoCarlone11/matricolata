'use client';

import { useState, useEffect } from 'react';
import { getApprovedRequestsByUser } from '@/lib/firebase';
import { Award, Calendar } from 'lucide-react';

export default function StoricoPunti({ currentUser }) {
  const [groupedHistory, setGroupedHistory] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      const data = await getApprovedRequestsByUser(currentUser.id);
      
      // Raggruppa per data
      const grouped = data.reduce((acc, item) => {
        const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
        // Formato: Lunedì 24 Ottobre
        const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(item);
        return acc;
      }, {});

      setGroupedHistory(grouped);
      setLoading(false);
    };
    loadHistory();
  }, [currentUser]);

  if (loading) return <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div></div>;

  return (
    <div className="mt-8 pb-12">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Award size={28} className="text-red-600" /> Il Tuo Percorso
      </h2>

      {Object.keys(groupedHistory).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500">Nessuna sfida completata... ancora!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedHistory).map(date => (
            <div key={date} className="relative">
              {/* Linea temporale */}
              <div className="absolute left-2.5 top-8 bottom-0 w-0.5 bg-gray-200"></div>
              
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-red-100 border-2 border-red-500 z-10"></div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider capitalize">{date}</h3>
              </div>

              <div className="pl-8 space-y-3">
                {groupedHistory[date].map((item) => (
                  <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-gray-900">{item.challengeName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.manual ? 'Bonus Admin' : 'Sfida Completata'}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold text-sm shadow-md">
                      +{item.puntiRichiesti}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
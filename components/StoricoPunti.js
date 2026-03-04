'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApprovedRequestsByUser } from '@/lib/firebase';
import { Award, Clock, ChevronDown } from 'lucide-react';

export default function StoricoPunti({ currentUser, systemSettings }) {
  const [groupedHistory, setGroupedHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const isFeedCacheEnabled = systemSettings?.feedCacheEnabled ?? true;
  const feedCacheMinutes = systemSettings?.feedCacheDuration ?? 2;
  const CACHE_KEY = `storico_${currentUser.id}`;

  // Raggruppa per data e mergia con lo stato esistente
  const groupAndMerge = (existingGrouped, newItems) => {
    const merged = { ...existingGrouped };
    newItems.forEach(item => {
      const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
      const dateStr = dateObj.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      if (!merged[dateStr]) merged[dateStr] = [];
      // Evitiamo duplicati
      if (!merged[dateStr].find(i => i.id === item.id)) {
        merged[dateStr].push(item);
      }
    });
    return merged;
  };

  // Caricamento iniziale
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);

      if (!isFeedCacheEnabled) {
        localStorage.removeItem(CACHE_KEY);
      } else {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const diffMinutes = (new Date().getTime() - timestamp) / 1000 / 60;
          if (diffMinutes < feedCacheMinutes) {
            setGroupedHistory(data);
            setHasMore(false); // Con cache non gestiamo "mostra altro"
            setLoading(false);
            return;
          }
        }
      }

      try {
        const { data, lastDoc: newLastDoc, hasMore: more } = await getApprovedRequestsByUser(currentUser.id);
        const grouped = groupAndMerge({}, data);

        if (isFeedCacheEnabled) {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: grouped,
            timestamp: new Date().getTime()
          }));
        }

        setGroupedHistory(grouped);
        setLastDoc(newLastDoc);
        setHasMore(more);
      } catch (e) {
        console.error("Errore Storico:", e);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [currentUser.id, isFeedCacheEnabled, feedCacheMinutes]);

  // Carica altri 5
  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data, lastDoc: newLastDoc, hasMore: more } = await getApprovedRequestsByUser(currentUser.id, lastDoc);
      setGroupedHistory(prev => groupAndMerge(prev, data));
      setLastDoc(newLastDoc);
      setHasMore(more);
    } catch (e) {
      console.error("Errore caricamento aggiuntivo:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [currentUser.id, lastDoc, loadingMore]);

  if (loading) return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
    </div>
  );

  return (
    <div className="mt-8 pb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award size={28} className="text-[#B41F35]" /> Il Tuo Storico
        </h2>
        {isFeedCacheEnabled && (
          <span className="text-[10px] text-gray-400 flex items-center gap-1 uppercase font-bold bg-gray-100 px-2 py-1 rounded-full">
            <Clock size={10} /> Aggiornato ogni {feedCacheMinutes} min
          </span>
        )}
      </div>

      {Object.keys(groupedHistory).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500">Nessuna attività registrata.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedHistory).map(date => (
            <div key={date} className="relative">
              <div className="absolute left-2.5 top-8 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-red-100 border-2 border-[#B41F35] z-10"></div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider capitalize">{date}</h3>
              </div>
              <div className="pl-8 space-y-3">
                {groupedHistory[date].map((item) => {
                  const isMalus = item.puntiRichiesti < 0;
                  return (
                    <div key={item.id} className={`bg-white border rounded-2xl p-4 shadow-sm flex justify-between items-center ${isMalus ? 'border-red-100 bg-red-50/50' : 'border-gray-100'}`}>
                      <div>
                        <h3 className={`font-bold ${isMalus ? 'text-red-900' : 'text-gray-900'} flex items-center gap-2`}>
                          {item.challengeName || "Sfida"}
                          {isMalus && <span className="text-[10px] bg-red-600 text-white px-1.5 rounded uppercase">Malus</span>}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.manual ? (isMalus ? 'Malus dagli admin' : 'Bonus dagli admin') : 'Completato'}
                        </p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-xl font-black text-sm border ${isMalus ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                        {item.puntiRichiesti > 0 ? '+' : ''}{item.puntiRichiesti}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottone Mostra Altro */}
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:border-[#B41F35] hover:text-[#B41F35] transition-all disabled:opacity-50"
          >
            {loadingMore
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#B41F35]" />
              : <ChevronDown size={16} />
            }
            {loadingMore ? 'Caricamento...' : 'Mostra altro'}
          </button>
        </div>
      )}
    </div>
  );
}
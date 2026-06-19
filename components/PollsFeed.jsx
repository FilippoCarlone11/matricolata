'use client';

import { useState, useEffect } from 'react';
import { onPollsChange, createPoll, votePoll, deletePoll } from '@/lib/firebase';
import { BarChart3, Plus, X, Trash2, Check, Loader2, Send } from 'lucide-react';

export default function PollsFeed({ currentUser, t }) {
  const tr = (text) => (t ? t(text) : text);

  const [polls, setPolls] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState(null);

  const uid = currentUser?.id || currentUser?.uid;
  const canCreate = currentUser?.role && currentUser.role !== 'matricola';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
    const unsub = onPollsChange(setPolls);
    return () => unsub();
  }, []);

  const addOption = () => setOptions((prev) => (prev.length >= 6 ? prev : [...prev, '']));
  const removeOption = (i) => setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  const updateOption = (i, val) => setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  const resetComposer = () => {
    setQuestion('');
    setOptions(['', '']);
    setShowComposer(false);
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await createPoll(question, options, currentUser);
      resetComposer();
    } catch (e) {
      alert(e.message || 'Errore creazione sondaggio.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (poll, idx) => {
    if (!uid) return;
    setVotingId(poll.id);
    try {
      await votePoll(poll.id, uid, idx);
    } catch (e) {
      alert('Errore durante il voto.');
    } finally {
      setVotingId(null);
    }
  };

  const handleDelete = async (poll) => {
    if (!confirm(`Eliminare il sondaggio "${poll.question}"?`)) return;
    try {
      await deletePoll(poll.id);
    } catch (e) {
      alert('Errore eliminazione.');
    }
  };

  if (polls.length === 0 && !canCreate) return null;

  return (
    <div className="space-y-4 mb-6">
      {/* PULSANTE / COMPOSER (solo non-matricole) */}
      {canCreate && (
        <div>
          {!showComposer ? (
            <button
              onClick={() => setShowComposer(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-gray-300 text-gray-500 hover:text-[#B41F35] hover:border-[#B41F35] rounded-2xl py-3 font-bold text-sm transition-colors shadow-sm"
            >
              <BarChart3 size={18} /> {tr('Crea un sondaggio')}
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#B41F35]" /> {tr('Nuovo sondaggio')}
                </h3>
                <button onClick={resetComposer} className="text-gray-400 hover:text-gray-700 p-1">
                  <X size={20} />
                </button>
              </div>

              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={tr('Scrivi la domanda...')}
                maxLength={140}
                className="w-full p-3 rounded-xl border border-gray-200 text-sm font-medium focus:ring-2 focus:ring-[#B41F35]/40 focus:border-transparent outline-none"
              />

              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`${tr('Opzione')} ${i + 1}`}
                      maxLength={80}
                      className="flex-1 p-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#B41F35]/40 focus:border-transparent outline-none"
                    />
                    {options.length > 2 && (
                      <button onClick={() => removeOption(i)} className="text-gray-300 hover:text-red-500 p-1">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {options.length < 6 ? (
                  <button onClick={addOption} className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#B41F35]">
                    <Plus size={14} /> {tr('Aggiungi opzione')}
                  </button>
                ) : <span />}
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-[#B41F35] text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-[#90192a] active:scale-95 transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {tr('Pubblica')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LISTA SONDAGGI */}
      {polls.map((poll) => {
        const votes = poll.votes || {};
        const myVote = uid ? votes[uid] : undefined;
        const hasVoted = myVote !== undefined && myVote !== null;
        const counts = (poll.options || []).map(
          (_, i) => Object.values(votes).filter((v) => Number(v) === i).length
        );
        const total = counts.reduce((a, b) => a + b, 0);
        const canDelete = isAdmin || poll.authorId === uid;

        return (
          <div key={poll.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-3 flex items-center justify-between border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#B41F35]/10 flex items-center justify-center shrink-0">
                  {poll.authorPhoto ? (
                    <img src={poll.authorPhoto} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <BarChart3 size={16} className="text-[#B41F35]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide leading-none mb-0.5">{tr('Sondaggio')}</p>
                  <p className="text-xs font-bold text-gray-600 truncate">{poll.authorName}</p>
                </div>
              </div>
              {canDelete && (
                <button onClick={() => handleDelete(poll)} className="text-gray-300 hover:text-red-500 p-1.5">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="p-4">
              <p className="font-black text-gray-900 text-base mb-4 leading-snug">{poll.question}</p>

              <div className="space-y-2">
                {(poll.options || []).map((opt, i) => {
                  const count = counts[i];
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isMine = hasVoted && Number(myVote) === i;

                  // PRIMA del voto: opzioni cliccabili. DOPO: barre con risultati.
                  if (!hasVoted) {
                    return (
                      <button
                        key={i}
                        onClick={() => handleVote(poll, i)}
                        disabled={votingId === poll.id}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:border-[#B41F35] hover:bg-[#B41F35]/5 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleVote(poll, i)}
                      disabled={votingId === poll.id}
                      className={`relative w-full overflow-hidden text-left px-4 py-3 rounded-xl border transition-all ${
                        isMine ? 'border-[#B41F35]' : 'border-gray-200'
                      }`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 ${isMine ? 'bg-[#B41F35]/15' : 'bg-gray-100'} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between">
                        <span className={`text-sm font-bold flex items-center gap-1.5 ${isMine ? 'text-[#B41F35]' : 'text-gray-700'}`}>
                          {isMine && <Check size={14} />} {opt}
                        </span>
                        <span className={`text-sm font-black ${isMine ? 'text-[#B41F35]' : 'text-gray-500'}`}>{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-gray-400 mt-3 font-bold uppercase tracking-wide">
                {total} {total === 1 ? tr('voto') : tr('voti')}
                {hasVoted && <span className="text-gray-300"> · {tr('Tocca per cambiare')}</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

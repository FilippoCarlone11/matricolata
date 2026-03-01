'use client';

import { useState, useEffect } from 'react';
import { db, auth, submitLiveVote } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserData } from '@/lib/firebase';
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function LiveVotingOverlay() {
    const pathname = usePathname();
    const [liveData, setLiveData] = useState(null);
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [isVoting, setIsVoting] = useState(false);

    useEffect(() => {
        // 1. Ascolta l'utente
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                const data = await getUserData(firebaseUser.uid);
                if (data) setUserData(data);
            } else {
                setUser(null);
                setUserData(null);
            }
        });

        // 2. Ascolta il documento Live Voting
        const liveRef = doc(db, 'live_voting', 'current');
        const unsubscribeLive = onSnapshot(liveRef, (docSnap) => {
            if (docSnap.exists()) {
                setLiveData(docSnap.data());
            } else {
                setLiveData(null);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeLive();
        };
    }, []);

    // Se l'overlay non è attivo, non renderizzare nulla
    // Inoltre, NON lo renderizziamo se siamo nella pagina di regia
    if (!liveData || !liveData.isActive || pathname === '/regia-eventi') return null;

    const handleVote = async (value) => {
        if (!user) return;
        setIsVoting(true);
        try {
            await submitLiveVote(user.uid, value);
        } catch (error) {
            alert("Errore durante l'invio del voto. Riprova.");
        } finally {
            setIsVoting(false);
        }
    };

    const hasVoted = user && liveData.votes && liveData.votes[user.uid];

    return (
        <div className="fixed inset-0 z-[100] backdrop-blur-xl bg-black/90 flex flex-col items-center justify-center p-4 sm:p-6 text-white animate-in fade-in duration-300">

            {/* HEADER ESIBIZIONE */}
            <div className="w-full max-w-3xl text-center mb-8 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/30 blur-[100px] rounded-full pointer-events-none"></div>
                <p className="text-purple-400 font-bold uppercase tracking-[0.2em] text-sm md:text-base mb-2 animate-pulse">
                    Sta parlando ora
                </p>
                <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4 drop-shadow-lg">
                    {liveData.matricolaName}
                </h1>
                <div className="inline-block bg-white/10 border border-white/20 px-6 py-2 rounded-full backdrop-blur-md">
                    <p className="text-gray-200 font-medium text-sm md:text-lg">
                        Tema: <span className="font-bold text-white">{liveData.theme}</span>
                    </p>
                </div>
            </div>

            {/* RISOLUZIONE STATI UTENTE */}
            <div className="w-full max-w-2xl bg-gray-900/80 border border-gray-700 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden backdrop-blur-sm">

                {/* STATO 1: Utente non loggato */}
                {!user && (
                    <div className="text-center py-8">
                        <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4 opacity-80" />
                        <h2 className="text-2xl font-black text-white mb-2">Devi effettuare l'accesso</h2>
                        <p className="text-gray-400">Accedi a Matricolata.it per poter partecipare al televoto live.</p>
                    </div>
                )}

                {/* STATO 2: Utente Matricola (Non può votare) */}
                {user && userData?.role === 'matricola' && (
                    <div className="text-center py-8">
                        <XCircle size={64} className="text-red-500 mx-auto mb-4 opacity-80" />
                        <h2 className="text-2xl font-black text-white mb-2">Votazioni in corso</h2>
                        <p className="text-gray-300 text-lg">Le matricole non possono partecipare al televoto. Attendi la fine dell'esibizione!</p>
                    </div>
                )}

                {/* STATO 3: Utente autorizzato, ma votazioni ancora chiuse */}
                {user && userData?.role !== 'matricola' && !liveData.votingOpen && (
                    <div className="text-center py-8 animate-pulse">
                        <Loader2 size={64} className="text-purple-500 mx-auto mb-4 animate-spin opacity-80" />
                        <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Preparati a votare</h2>
                        <p className="text-gray-300 text-lg">Ascolta l'esibizione. Il televoto si aprirà a breve...</p>
                    </div>
                )}

                {/* STATO 4: Utente ha già votato */}
                {user && userData?.role !== 'matricola' && liveData.votingOpen && hasVoted && (
                    <div className="text-center py-8 animate-in zoom-in-95 duration-500">
                        <div className="w-32 h-32 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                            <div className="absolute inset-0 border-4 border-green-500/30 rounded-full animate-ping"></div>
                            <CheckCircle2 size={80} className="text-green-500" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Voto Registrato!</h2>
                        <p className="text-gray-300 text-lg">Hai assegnato un {liveData.votes[user.uid]}. Attendi i risultati dalla regia.</p>
                    </div>
                )}

                {/* STATO 5: Utente autorizzato può votare! */}
                {user && userData?.role !== 'matricola' && liveData.votingOpen && !hasVoted && (
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-white">Vota l'esibizione</h2>
                            <p className="text-gray-400">Scegli un voto da 1 a 10. Non potrai cambiarlo.</p>
                        </div>

                        <div className="grid grid-cols-5 gap-3 md:gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                                // Colori dinamici in base al voto (rosso -> verde)
                                const getColors = (n) => {
                                    if (n <= 4) return 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500 hover:text-white';
                                    if (n <= 6) return 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500 hover:text-white';
                                    if (n <= 8) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500 hover:text-white';
                                    return 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500 hover:text-white';
                                };

                                return (
                                    <button
                                        key={num}
                                        onClick={() => handleVote(num)}
                                        disabled={isVoting}
                                        className={`
                      aspect-square rounded-2xl md:rounded-3xl border-2 flex items-center justify-center
                      text-2xl md:text-4xl font-black shadow-lg transition-all 
                      active:scale-90 hover:scale-105 disabled:opacity-50 disabled:active:scale-100 disabled:hover:scale-100
                      ${getColors(num)}
                    `}
                                    >
                                        {isVoting ? <Loader2 className="animate-spin w-6 h-6" /> : num}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
}

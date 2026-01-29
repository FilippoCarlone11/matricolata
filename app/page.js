'use client';

import { useState, useEffect } from 'react';
import { auth, getUserData, signOutUser } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from '@/components/Login';
import ChallengeList from '@/components/ChallengeList';
import StoricoPunti from '@/components/StoricoPunti';
import AdminUserList from '@/components/AdminUserList';
import AdminRequests from '@/components/AdminRequests';
import AdminChallenges from '@/components/AdminChallenges';
import Navigation from '@/components/Navigation';
import SquadraMercato from '@/components/SquadraMercato';
import Classifiche from '@/components/Classifiche';
import AdminMatricolaHistory from '@/components/AdminMatricolaHistory';
import { Trophy, LogOut } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // activeTab gestisce tutto ora (home, squadra, classifiche, admin-sfide, admin-utenti)
  const [activeTab, setActiveTab] = useState('home'); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const data = await getUserData(firebaseUser.uid);
        setUserData(data);
        // Redirect iniziale intelligente
        if (data.role === 'matricola') setActiveTab('home');
        else setActiveTab('squadra');
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshUserData = async () => {
    if (user) {
      const data = await getUserData(user.uid);
      setUserData(data);
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); } catch (error) { console.error(error); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;
  if (!user || !userData) return <Login />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-lg mx-auto p-4 pb-28">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={user.photoURL} className="w-10 h-10 rounded-full border border-gray-300" />
            <div>
              <h1 className="font-bold text-lg leading-tight">{user.displayName}</h1>
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{userData.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-500 hover:text-red-600 transition-colors"><LogOut size={18} /></button>
        </div>

        {/* --- VISTA MATRICOLA --- */}
        {userData.role === 'matricola' && (
          <>
            {activeTab === 'home' && (
              <>
                <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-3xl p-6 text-white mb-6 shadow-xl relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <span className="text-red-100 font-medium text-sm uppercase tracking-wide">Punteggio Attuale</span>
                      <div className="text-5xl font-black mt-1">{userData.punti || 0}</div>
                    </div>
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm"><Trophy size={32} /></div>
                  </div>
                </div>
                <ChallengeList currentUser={userData} />
                <StoricoPunti currentUser={userData} />
              </>
            )}
            {activeTab === 'classifiche' && <Classifiche />}
          </>
        )}

        {/* --- VISTA ADMIN / UTENTE --- */}
        {userData.role !== 'matricola' && (
          <>
            {/* Tab 1: SQUADRA & MERCATO */}
            {activeTab === 'squadra' && (
              <SquadraMercato currentUser={userData} onUpdate={refreshUserData} />
            )}
            
            {/* Tab 2: CLASSIFICHE */}
            {activeTab === 'classifiche' && <Classifiche />}
            
            {/* Tab 3: ADMIN SFIDE (Solo se Admin) */}
           {activeTab === 'admin-sfide' && userData.role === 'admin' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <AdminRequests />
                <div className="border-t border-gray-200"></div>
                <AdminChallenges />
              </div>
            )}

            {/* NUOVO TAB 4: STORICO MATRICOLE */}
            {activeTab === 'admin-matricole' && userData.role === 'admin' && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <AdminMatricolaHistory />
               </div>
            )}

            {/* Tab 5: ADMIN UTENTI */}
            {activeTab === 'admin-utenti' && userData.role === 'admin' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <AdminUserList />
              </div>
            )}

            {/* Tab 4: ADMIN UTENTI (Solo se Admin) */}
            {activeTab === 'admin-utenti' && userData.role === 'admin' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Qui gestisci ruoli e punti manuali */}
                <AdminUserList />
              </div>
            )}
          </>
        )}

      </div>
      
      {/* NAVIGATION BAR */}
      {userData.role === 'matricola' ? (
         <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 pb-safe">
            <div className="max-w-lg mx-auto flex">
              <button onClick={() => setActiveTab('home')} className={`flex-1 py-3 flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-red-600' : 'text-gray-400'}`}>
                <Trophy size={24} /><span className="text-[10px] font-bold">Sfide</span>
              </button>
              <button onClick={() => setActiveTab('classifiche')} className={`flex-1 py-3 flex flex-col items-center gap-1 ${activeTab === 'classifiche' ? 'text-red-600' : 'text-gray-400'}`}>
                <Trophy size={24} /><span className="text-[10px] font-bold">Classifiche</span>
              </button>
            </div>
         </div>
      ) : (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} role={userData.role} />
      )}
    </div>
  );
}
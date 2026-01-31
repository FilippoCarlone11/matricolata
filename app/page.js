'use client';

import { useState, useEffect } from 'react';
import { auth, getUserData, signOutUser } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from '@/components/Login';
import ChallengeList from '@/components/ChallengeList';
import StoricoPunti from '@/components/StoricoPunti';
import AdminUserList from '@/components/AdminUserList';
import AdminMatricolaHistory from '@/components/AdminMatricolaHistory';
import AdminSfideManager from '@/components/AdminSfideManager'; 
import EditProfile from '@/components/EditProfile'; 
import Navigation from '@/components/Navigation';
import SquadraMercato from '@/components/SquadraMercato';
import Classifiche from '@/components/Classifiche';
import BonusMalusList from '@/components/BonusMalusList'; 
import NewsFeed from '@/components/NewsFeed'; 
import AccountGenerator from '@/components/AccountGenerator'; // <--- GENERATORE TEST
import { Trophy, LogOut, Edit2 } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Default 'feed' (Bacheca) all'avvio
  const [activeTab, setActiveTab] = useState('feed'); 
  
  const [showProfile, setShowProfile] = useState(false); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const data = await getUserData(firebaseUser.uid);
        setUserData(data);
        // Non forziamo il tab qui per lasciare libertà all'utente se ricarica
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

  const isSuperAdmin = userData.role === 'super-admin';
  const isAdminOrSuper = userData.role === 'admin' || isSuperAdmin;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-lg mx-auto p-4 pb-28">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div 
            className="flex items-center gap-3 cursor-pointer group p-2 -ml-2 rounded-xl hover:bg-white hover:shadow-sm transition-all select-none"
            onClick={() => setShowProfile(true)}
          >
            <div className="relative">
                <img src={userData.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full border border-gray-300 object-cover" />
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow border border-gray-200 text-gray-500">
                    <Edit2 size={10} />
                </div>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                 {userData.displayName}
              </h1>
              {userData.role !== 'matricola' && userData.teamName && (
                  <span className="text-xs font-bold text-purple-600 block">{userData.teamName}</span>
              )}
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mt-0.5">{userData.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-500 hover:text-red-600 transition-colors"><LogOut size={18} /></button>
        </div>

        {/* --- FEED (VISIBILE A TUTTI) --- */}
        {activeTab === 'feed' && <NewsFeed />}

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
              </>
            )}
            {activeTab === 'lista' && <BonusMalusList currentUser={userData} />}
            {activeTab === 'percorso' && <StoricoPunti currentUser={userData} />}
          </>
        )}

        {/* --- VISTA ADMIN / UTENTE --- */}
        {userData.role !== 'matricola' && (
          <>
            {activeTab === 'squadra' && <SquadraMercato currentUser={userData} onUpdate={refreshUserData} />}
            {activeTab === 'classifiche' && <Classifiche />}
            {activeTab === 'lista' && <BonusMalusList currentUser={userData} />} 

            {/* GESTIONE SFIDE */}
            {activeTab === 'admin-sfide' && isAdminOrSuper && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <AdminSfideManager />
              </div>
            )}

            {activeTab === 'admin-matricole' && isAdminOrSuper && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <AdminMatricolaHistory />
               </div>
            )}

            {activeTab === 'admin-utenti' && isSuperAdmin && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <AdminUserList currentUser={userData} />
              </div>
            )}
          </>
        )}

      </div>

      {/* MODALE EDIT PROFILE */}
      {showProfile && user && (
          <EditProfile user={userData} onClose={() => setShowProfile(false)} onUpdate={refreshUserData} />
      )}
      

      {/* NAVIGATION BAR */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} role={userData.role} />
    </div>
  );
}
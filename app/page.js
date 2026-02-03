'use client';

import { useState, useEffect } from 'react';
// AGGIUNTO getChallenges e getAllUsers
import { auth, db, getUserData, signOutUser, getChallenges, getAllUsers } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; 

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
import AccountGenerator from '@/components/AccountGenerator'; 
import { Trophy, LogOut, Edit2 } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- CACHE GLOBALE (Scarichiamo 1 volta e basta) ---
  const [globalChallenges, setGlobalChallenges] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);

  const [activeTab, setActiveTab] = useState('feed'); 
  const [showProfile, setShowProfile] = useState(false); 

  useEffect(() => {
    let unsubscribeUser = () => {}; 
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setActiveTab('feed'); 
        
        // 1. Ascolto Utente Corrente (Realtime)
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setUserData({ id: docSnap.id, ...docSnap.data() });
          setLoading(false);
        });

        // 2. SCARICHIAMO DATI PESANTI UNA VOLTA SOLA
        try {
            const [challengesData, usersData] = await Promise.all([
                getChallenges(),
                getAllUsers()
            ]);
            setGlobalChallenges(challengesData);
            setGlobalUsers(usersData);
        } catch(e) { console.error("Errore cache:", e); }

      } else {
        setUser(null);
        setUserData(null);
        setGlobalChallenges([]);
        setGlobalUsers([]);
        unsubscribeUser(); 
        setLoading(false);
      }
    });
    return () => { unsubscribeAuth(); unsubscribeUser(); };
  }, []);

  const refreshUserData = async () => {
    if (user) { const data = await getUserData(user.uid); setUserData(data); }
  };

  const handleLogout = async () => { try { await signOutUser(); } catch (error) { console.error(error); } };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;
  if (!user || !userData) return <Login />;

  const isSuperAdmin = userData.role === 'super-admin';
  const isAdminOrSuper = userData.role === 'admin' || isSuperAdmin;

  // Funzione helper per nascondere/mostrare senza smontare (RISPARMIO LETTURE)
  const TabContent = ({ id, children }) => (
    <div style={{ display: activeTab === id ? 'block' : 'none' }}>
      {children}
    </div>
  );

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

        {/* ============================================================ */}
        {/* IL TRUCCO SALVA-SOLDI: RENDERIZZIAMO TUTTO MA NASCONDIAMO    */}
        {/* ============================================================ */}

        {/* 1. Feed (Tutti) - Carica 20 docs 1 volta sola */}
        <TabContent id="feed">
           <NewsFeed />
        </TabContent>

        {userData.role === 'matricola' ? (
          <>
            {/* 2. Sfide (Matricola) */}
            <TabContent id="home">
                <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-3xl p-6 text-white mb-6 shadow-xl relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <span className="text-red-100 font-medium text-sm uppercase tracking-wide">Punteggio Attuale</span>
                      <div className="text-5xl font-black mt-1">{userData.punti || 0}</div>
                    </div>
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm"><Trophy size={32} /></div>
                  </div>
                </div>
                {/* MODIFICA: Passiamo preloadedChallenges */}
                <ChallengeList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            {/* 3. Lista Regole */}
            <TabContent id="lista">
                {/* MODIFICA: Passiamo preloadedChallenges */}
                <BonusMalusList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            {/* 4. Storico */}
            <TabContent id="percorso">
                <StoricoPunti currentUser={userData} />
            </TabContent>
          </>
        ) : (
          /* VISTA NON-MATRICOLA */
          <>
            <TabContent id="squadra">
                 <SquadraMercato currentUser={userData} onUpdate={refreshUserData} />
            </TabContent>
            
            <TabContent id="classifiche">
                 {/* MODIFICA: Passiamo preloadedUsers */}
                 <Classifiche preloadedUsers={globalUsers} />
            </TabContent>
            
            <TabContent id="lista">
                 {/* MODIFICA: Passiamo preloadedChallenges */}
                 <BonusMalusList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            {activeTab === 'admin-sfide' && isAdminOrSuper && <AdminSfideManager />}
            {activeTab === 'admin-matricole' && isAdminOrSuper && <AdminMatricolaHistory />}
            {activeTab === 'admin-utenti' && isSuperAdmin && <AdminUserList currentUser={userData} />}
          </>
        )}

      </div>

      {showProfile && user && (
          <EditProfile user={userData} onClose={() => setShowProfile(false)} onUpdate={refreshUserData} />
      )}
      
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} role={userData.role} />
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { auth, db, getUserData, signOutUser, getChallenges, getAllUsers, getSystemSettings } from '@/lib/firebase';
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
// RIMOSSO: import AccountGenerator from '@/components/AccountGenerator'; 
import InstallPrompt from '@/components/InstallPrompt'; // <--- NUOVO IMPORT

import { Trophy, LogOut, Edit2 } from 'lucide-react';

// --- COMPONENTE TAB ---
const TabContent = ({ id, activeTab, children }) => {
  return (
    <div style={{ display: activeTab === id ? 'block' : 'none' }}>
      {children}
    </div>
  );
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [globalChallenges, setGlobalChallenges] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);

  const [activeTab, setActiveTab] = useState('feed'); 
  const [showProfile, setShowProfile] = useState(false); 

  // --- FUNZIONE CACHE CON ON/OFF ---
  const fetchWithCache = async (key, fetcher, expiryMinutes, isCacheEnabled) => {
    // SE LA CACHE È SPENTA DAL SISTEMA -> SCARICA SEMPRE
    if (!isCacheEnabled) {
        // console.warn(`CACHE DISABLED BY ADMIN for ${key}: Fetching fresh data.`);
        localStorage.removeItem(key);
        return await fetcher();
    }

    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            const parsed = JSON.parse(cached);
            const now = new Date().getTime();
            if (now - parsed.timestamp < expiryMinutes * 60 * 1000) {
                // console.log(`Using cached ${key} (0 reads)`);
                return parsed.data;
            }
        }
        // console.log(`Fetching new ${key} from DB...`);
        const data = await fetcher();
        localStorage.setItem(key, JSON.stringify({
            data: data,
            timestamp: new Date().getTime()
        }));
        return data;
    } catch (e) {
        return await fetcher();
    }
  };

  useEffect(() => {
    let unsubscribeUser = () => {}; 
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setActiveTab('feed'); 
        
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setUserData({ id: docSnap.id, ...docSnap.data() });
          setLoading(false);
        });

        // --- LOGICA DI CARICAMENTO ---
        try {
            const settings = await getSystemSettings();
            const isCacheEnabled = settings?.cacheEnabled ?? true; 
            const cacheTime = settings?.cacheDuration ?? 30;

            const [challengesData, usersData] = await Promise.all([
                fetchWithCache('cache_challenges', getChallenges, cacheTime, isCacheEnabled),
                fetchWithCache('cache_users', getAllUsers, cacheTime, isCacheEnabled)
            ]);
            setGlobalChallenges(challengesData);
            setGlobalUsers(usersData);
        } catch(e) { console.error("Errore caricamento dati:", e); }

      } else {
        setUser(null);
        setUserData(null);
        setGlobalChallenges([]);
        setGlobalUsers([]);
        unsubscribeUser(); 
        setLoading(false);
        localStorage.removeItem('cache_challenges');
        localStorage.removeItem('cache_users');
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      
      {/* POPUP INSTALLAZIONE PWA */}
      <InstallPrompt />

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

        <TabContent id="feed" activeTab={activeTab}>
           <NewsFeed />
        </TabContent>

        {userData.role === 'matricola' ? (
          <>
            <TabContent id="home" activeTab={activeTab}>
                <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-3xl p-6 text-white mb-6 shadow-xl relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <span className="text-red-100 font-medium text-sm uppercase tracking-wide">Punteggio Attuale</span>
                      <div className="text-5xl font-black mt-1">{userData.punti || 0}</div>
                    </div>
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm"><Trophy size={32} /></div>
                  </div>
                </div>
                <ChallengeList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            <TabContent id="lista" activeTab={activeTab}>
                <BonusMalusList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            <TabContent id="percorso" activeTab={activeTab}>
                <StoricoPunti currentUser={userData} />
            </TabContent>
          </>
        ) : (
          <>
            <TabContent id="squadra" activeTab={activeTab}>
                 <SquadraMercato currentUser={userData} onUpdate={refreshUserData} preloadedUsers={globalUsers} />
            </TabContent>
            
            <TabContent id="classifiche" activeTab={activeTab}>
                 <Classifiche preloadedUsers={globalUsers} />
            </TabContent>
            
            <TabContent id="lista" activeTab={activeTab}>
                 <BonusMalusList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            {activeTab === 'admin-sfide' && isAdminOrSuper && <AdminSfideManager />}
            {activeTab === 'admin-matricole' && isAdminOrSuper && <AdminMatricolaHistory />}
            {activeTab === 'admin-utenti' && isSuperAdmin && <AdminUserList currentUser={userData} preloadedUsers={globalUsers} />}
          </>
        )}

      </div>

      {showProfile && user && (
          <EditProfile user={userData} onClose={() => setShowProfile(false)} onUpdate={refreshUserData} />
      )}
      
      {/* AccountGenerator RIMOSSO QUI */}
      
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} role={userData.role} />
    </div>
  );
}
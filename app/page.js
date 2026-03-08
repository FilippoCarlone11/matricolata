'use client';

import { useState, useEffect } from 'react';
import { auth, db, getUserData, signOutUser, getChallenges, getAllUsers, getSystemSettings } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; 
import { NAP_DICT } from '@/lib/dictionary'; // <--- IMPORTIAMO IL DIZIONARIO PULITO

import Login from '@/components/Login';
import ChallengeList from '@/components/ChallengeList';
import MatricolaStoricoPunti from '@/components/MatricolaStoricoPunti';
import AdminDashboard from '@/components/AdminDashboard';
import AdminSfideManager from '@/components/AdminSfideManager'; 
import EditProfile from '@/components/EditProfile'; 
import Navigation from '@/components/Navigation';
import SquadraMercato from '@/components/SquadraMercato';
import Classifiche from '@/components/Classifiche';
import BonusMalusList from '@/components/BonusMalusList'; 
import NewsFeed from '@/components/NewsFeed'; 

import { Trophy, LogOut, Edit2, LockKeyhole, Pizza, AlertCircle, Crown, Users } from 'lucide-react'; 

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
  const [systemSettings, setSystemSettings] = useState({}); 
  
  const [activeTab, setActiveTab] = useState('feed'); 
  const [showProfile, setShowProfile] = useState(false); 

  // --- EASTER EGGS STATES ---
  const [yellowTheme, setYellowTheme] = useState(false);
  const [neapolitanMode, setNeapolitanMode] = useState(false); 

  // --- FUNZIONE TRADUZIONE ---
  const t = (text) => {
      if (neapolitanMode && NAP_DICT[text]) {
          return NAP_DICT[text];
      }
      return text;
  };

  const fetchWithCache = async (key, fetcher, expiryMinutes, isCacheEnabled) => {
    if (!isCacheEnabled) {
        localStorage.removeItem(key);
        return await fetcher();
    }

    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            const parsed = JSON.parse(cached);
            const now = new Date().getTime();
            const diffMinutes = (now - parsed.timestamp) / 1000 / 60;

            if (diffMinutes < expiryMinutes) {
                return parsed.data;
            }
        }
        
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
          if (docSnap.exists()) {
              const data = { id: docSnap.id, ...docSnap.data() };
              setUserData(data);
              
              // --- CARICA LA LINGUA SALVATA ---
              setNeapolitanMode(data.isNeapolitan ? true : false);
          }
          setLoading(false);
        });

        // ========================================================
        // 🚨 BLOCCO DATABASE PER MANUTENZIONE (Risparmio letture)
        // ========================================================
        try {
            const settings = await getSystemSettings();
            setSystemSettings(settings); 
            
            const userDoc = await getDoc(userRef);
            const role = userDoc.exists() ? userDoc.data().role : 'matricola';

            if (settings?.maintenanceMode && role !== 'admin' && role !== 'super-admin') {
                return; // 🛑 Esce dall'operazione
            }

            const isCacheEnabled = settings?.cacheEnabled ?? true; 
            const cacheTime = settings?.cacheDuration ?? 30;
            const usersCacheTime = settings?.cacheDuration ?? 30; 
            const challengesCacheTime = 1440; 
            
            const [challengesData, usersData] = await Promise.all([
                fetchWithCache('cache_challenges', getChallenges, challengesCacheTime, isCacheEnabled),
                fetchWithCache('cache_users', getAllUsers, usersCacheTime, isCacheEnabled)
            ]);
        
            setGlobalChallenges(challengesData);
            setGlobalUsers(usersData);
            
        } catch(e) { 
            console.error("Errore caricamento dati:", e); 
        }

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

  const triggerYellowTheme = () => {
      setYellowTheme(true);
      setTimeout(() => setYellowTheme(false), 10000);
  };

  const triggerNeapolitan = () => {
      setNeapolitanMode(!neapolitanMode); 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;
  if (!user || !userData) return <Login />;

  const isSuperAdmin = userData.role === 'super-admin';
  const isAdminOrSuper = userData.role === 'admin' || isSuperAdmin;
  const isBlurActive = userData.role === 'matricola' && systemSettings.matricolaBlur;

  // --- SCHERMATA DI BLOCCO MANUTENZIONE ---
  if (systemSettings?.maintenanceMode && !isAdminOrSuper) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden font-sans">
            <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gray-100 max-w-sm w-full z-10 relative">
                <div className="absolute inset-0 rounded-2xl border-4 border-yellow-400/60 animate-pulse pointer-events-none"></div>
                <div className="relative w-24 h-24 mx-auto mb-6 bg-gray-50 rounded-xl border-2 border-yellow-400 flex items-center justify-center shadow-sm">
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#B41F35] animate-pulse shadow-[0_0_8px_#B41F35]"></div>
                    </div>
                    <img src="/var-replay.png" alt="VAR Check" className="w-16 h-16 object-contain z-10" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 tracking-widest mb-2 uppercase">{t("VAR Check")}</h1>
                <div className="inline-block bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-sm animate-pulse mb-6 tracking-widest uppercase">
                    {t("Review in corso")}
                </div>
                <p className="text-gray-600 mb-8 font-medium leading-relaxed text-lg">
                    {t("Stiamo ricontrollando tutti i vostri punteggi!")}<br/>
                    <span className="text-[#B41F35] font-black block mt-4 text-xl">{t("Voi preparatevi per stasera!")} </span>
                </p>
                <button onClick={handleLogout} className="w-full bg-[#B41F35] text-white px-6 py-4 rounded-xl font-bold shadow-md hover:bg-[#91182a] transition-colors flex items-center justify-center gap-2">
                    <LogOut size={20} /> {t("Esci")}
                </button>
            </div>
        </div>
    );
  }

  // --- LOGICA BLOCCO CAPITANO ---
  const isCaptainMissing = userData.role !== 'matricola' && (!userData.captainId) && (userData.mySquad && userData.mySquad.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans relative">
      
      {/* OVERLAY TEMA GIALLO */}
      {yellowTheme && (
        <div 
            className="fixed inset-0 z-[9999] pointer-events-none animate-in fade-in duration-500"
            style={{ backgroundColor: 'rgba(253, 224, 71, 0.4)', mixBlendMode: 'color', backdropFilter: 'sepia(100%)' }}
        />
      )}

      {/* ICONA PIZZA NAPOLETANA */}
      {neapolitanMode && (
          <div className="fixed top-4 left-4 z-[50] animate-bounce pointer-events-none">
              <Pizza size={32} className="text-orange-500 drop-shadow-lg" />
          </div>
      )}

      {/* BLUR NEBBIA MATRICOLE */}
      {isBlurActive && (
        <div className="fixed inset-0 z-[100] backdrop-blur-xl bg-white/30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            <div className="absolute top-6 right-6">
                <button onClick={handleLogout} className="bg-white p-3 rounded-full shadow-xl text-gray-500 hover:text-red-600 transition-all border border-gray-200 hover:scale-110" title={t("Esci")}>
                    <LogOut size={20} />
                </button>
            </div>
            <div className="bg-white/80 p-8 rounded-3xl shadow-2xl border border-white/50 backdrop-blur-md max-w-sm">
                <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <LockKeyhole size={32} className="text-red-600" />
                </div>
                <h1 className="text-2xl font-black text-gray-900 mb-2">{t("Vista oscurata!")}</h1>
                <p className="text-gray-600 mb-6">
                    {t("Stiamo preparando una sorpresa.")} 
                    <br/><span className="font-bold text-[#B41F35]">{t("Tornate a studiare!")}</span>
                </p>
                <button onClick={() => window.location.reload()} className="bg-[#B41F35] text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">
                    {t("Riprova")}
                </button>
            </div>
        </div>
      )}

      {/* 🚨 OVERLAY BLOCCANTE CAPITANO TEMA ROSSO 🚨 */}
      {isCaptainMissing && activeTab !== 'squadra' && !isBlurActive && (
          <div className="fixed inset-0 z-[90] backdrop-blur-xl bg-white/60 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="absolute top-6 right-6">
                  <button onClick={handleLogout} className="bg-white p-3 rounded-full shadow-xl text-gray-500 hover:text-[#B41F35] transition-all border border-gray-200 hover:scale-110" title={t("Esci")}>
                      <LogOut size={20} />
                  </button>
              </div>
              <div className="bg-white/90 p-8 rounded-3xl shadow-2xl border border-[#B41F35]/30 backdrop-blur-md max-w-sm ring-4 ring-[#B41F35]/10">
                  <div className="bg-[#B41F35]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                      <AlertCircle size={32} className="text-[#B41F35]" />
                  </div>
                  <h1 className="text-2xl font-black text-gray-900 mb-2">{t("Capitano non impostato!")}</h1>
                  <p className="text-gray-600 mb-6 font-medium">
                      {t("Scegli il tuo capitano per raddoppiare i suoi punti!")}
                      <br/><span className="text-[#B41F35] font-bold block mt-2">{t("Devi farlo prima di continuare!")}</span>
                  </p>
                  <button onClick={() => setActiveTab('squadra')} className="w-full bg-[#B41F35] text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-[#90192a] active:scale-95 transition-all flex items-center justify-center gap-2">
                      <Users size={18} /> {t("Vai alla Squadra")}
                  </button>
              </div>
          </div>
      )}

      {/* Container Principale */}
      <div className={`max-w-lg mx-auto p-4 pb-28 ${isBlurActive ? 'filter blur-sm pointer-events-none overflow-hidden h-screen' : ''}`}>
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 cursor-pointer group p-2 -ml-2 rounded-xl hover:bg-white hover:shadow-sm transition-all select-none" onClick={() => setShowProfile(true)}>
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
                  <span className="text-xs font-bold text-[#B41F35] block">{userData.teamName}</span>
              )}
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mt-0.5">
                  {t(userData.role === 'matricola' ? 'Matricola' : (userData.role === 'super-admin' ? 'Super Admin' : (userData.role === 'admin' ? 'Admin' : 'Anziano')))}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-500 hover:text-[#B41F35] transition-colors">
              <LogOut size={18} />
          </button>
        </div>

        {/* 🚨 BANNER CAPITANO INLINE (Nella tab squadra) TEMA ROSSO 🚨 */}
        {isCaptainMissing && activeTab === 'squadra' && (
            <div className="bg-[#B41F35] border-2 border-[#90192a] rounded-2xl p-4 mb-6 shadow-xl flex items-center justify-between animate-pulse">
                <div>
                    <h3 className="font-black text-white text-sm flex items-center gap-2 drop-shadow-sm">
                        <AlertCircle size={18} /> {t("AZIONE RICHIESTA")}
                    </h3>
                    <p className="text-xs text-white/90 mt-1 font-medium leading-tight pr-2">
                        {t("Scegli il tuo capitano per raddoppiare i suoi punti!")} <br/>
                        <span className="font-bold text-white">{t("Devi impostarlo per sbloccare l'app.")}</span>
                    </p>
                </div>
                <div className="bg-white/20 p-2.5 rounded-full text-white shadow-sm shrink-0 backdrop-blur-sm">
                    <Crown size={20} />
                </div>
            </div>
        )}

        <TabContent id="feed" activeTab={activeTab}>
           <NewsFeed t={t} systemSettings={systemSettings}/>
        </TabContent>

        {userData.role === 'matricola' ? (
          <>
          <TabContent id="home" activeTab={activeTab}>
              <div className="bg-[#B41F35] rounded-3xl p-6 text-white mb-6 shadow-xl shadow-red-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-red-100 font-medium text-sm uppercase tracking-wide">{t("Punteggio Attuale")}</span>
                    <div className="text-5xl font-black mt-1">{userData.punti || 0}</div>
                  </div>
                  <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                      <Trophy size={32} className="text-white" />
                  </div>
                </div>
              </div>
              <ChallengeList currentUser={userData} preloadedChallenges={globalChallenges} t = {t} />
          </TabContent>

            <TabContent id="lista" activeTab={activeTab}>
                <BonusMalusList t = {t} currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            <TabContent id="percorso" activeTab={activeTab}>
                <MatricolaStoricoPunti t = {t} currentUser={userData} systemSettings={systemSettings}/>
            </TabContent>
          </>
        ) : (
          <>
            <TabContent id="squadra" activeTab={activeTab}>
                 <SquadraMercato currentUser={userData} onUpdate={refreshUserData} preloadedUsers={globalUsers} t={t} />
            </TabContent>
            
            <TabContent id="classifiche" activeTab={activeTab}>
                 <Classifiche 
                    preloadedUsers={globalUsers} 
                    currentUser={userData} 
                    onTriggerYellow={triggerYellowTheme} 
                    onTriggerNeapolitan={triggerNeapolitan} 
                 />
            </TabContent>
            
            <TabContent id="lista" activeTab={activeTab}>
                 <BonusMalusList t = {t} currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            {activeTab === 'admin-sfide' && isAdminOrSuper && <AdminSfideManager t = {t}/>}
            {activeTab === 'admin-utenti' && isSuperAdmin && <AdminDashboard currentUser={userData} preloadedUsers={globalUsers} t = {t}/>}
          </>
        )}

      </div>

      {showProfile && user && (
          <EditProfile 
              user={userData} 
              onClose={() => setShowProfile(false)} 
              onUpdate={refreshUserData}
              t={t} 
          />
      )}
      
      {/* SE MANCA IL CAPITANO NASCONDIAMO LA NAVBAR COSI' SONO INTRAPPOLATI NELLA SQUADRA! */}
      {!isBlurActive && !isCaptainMissing && (
         <Navigation activeTab={activeTab} setActiveTab={setActiveTab} role={userData.role} t={t}/>
      )}
    </div>
  );
}
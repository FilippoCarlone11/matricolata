'use client';

import { useState, useEffect } from 'react';
import { auth, db, getUserData, signOutUser, getChallenges, getAllUsers, getSystemSettings } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; 

import Login from '@/components/Login';
import ChallengeList from '@/components/ChallengeList';
import StoricoPunti from '@/components/StoricoPunti';
import AdminUserList from '@/components/AdminUserList';
import AdminSfideManager from '@/components/AdminSfideManager'; 
import EditProfile from '@/components/EditProfile'; 
import Navigation from '@/components/Navigation';
import SquadraMercato from '@/components/SquadraMercato';
import Classifiche from '@/components/Classifiche';
import BonusMalusList from '@/components/BonusMalusList'; 
import NewsFeed from '@/components/NewsFeed'; 
import InstallPrompt from '@/components/InstallPrompt'; 

import { Trophy, LogOut, Edit2, LockKeyhole, Pizza } from 'lucide-react'; 

const TabContent = ({ id, activeTab, children }) => {
  return (
    <div style={{ display: activeTab === id ? 'block' : 'none' }}>
      {children}
    </div>
  );
};

// ==========================================
// 🍕 DIZIONARIO NAPOLETANO
// ==========================================
const NAP_DICT = {
    // Generali
    "Punteggio Attuale": "O' Punteggio Tuojo",
    "Tornate a studiare!": "Jate a faticà!",
    "Sito in Aggiornamento": "Stamm facenn' e lavor'",
    "Vista oscurata!": "Ne vere niente!",
    "Riprova": "Prov n'ata vot",
    "Stiamo preparando una sorpresa.": "Stamm preparann' na cosa bella.",
    
    // Ruoli
    "Matricola": "Muccus",
    "Admin": "Mast",
    "Super Admin": "Capo mast",
    "Utente": "Uaglion",

    // Tabs & Navigazione
    "Feed": "Nciuci",
    "Richieste": "A' Dumann",
    "Archivio": "A' Storj",
    "Bonus/Malus": "Bonus/Malùs",
    "Squadra": "O Napl",
    "Classifiche": "Classifiche",
    "Utenti": "e Uagliun",
    
    // Azioni
    "Esci": "Vattenne",
    "Vedi Squadra": "Uard a squadra",
    "In Attesa di Approvazione": "stamm aspettan",
    "Richiesta inviata": "L'amm mannata", 
    "Approvato": "Appost",
    "Rifiutato": "Lev mano",
    "Richiesta Rifiutata": "Nun va buon",
    "Richiesta approvata": "Chell ca chiest",
    
    // Admin
    "Gestione Utenti": "Cumann' e uagliun",
    "System Control": "Gestisc o sistem",
    "Registrazioni": "Iscrizioni",
    "Cache Dati": "Memoria",
    "Blackout Matricole": "Stuta tutto",
    
    // Messaggi Vari
    "Nessun dato.": "Nce sta nient.",
    "Caricamento...": "Aspetta n'attimo...",
    
    // Profilo
    "Personalizza Profilo": "Cagna 'o Profilo",
    "Il tuo Nome": "Comm' te chiamm?",
    "Nome e Cognome...": "Mett 'o nomm...",
    "Nome Squadra": "Nomm d'a Squadra",
    "Es: SSC Napoli...": "Es: Maradona FC...",
    "Foto Profilo": "A' Faccia Toja",
    "Attuale": "Chella 'e mo",
    "Carica": "Careca",
    "Cartoon": "Disegn",
    "Link Web": "O' Link",
    "Salva Profilo": "Astipa Tutto",
    "Lingua App": "Comm'amma parlà?",
    
    // Feed Extra
    "Oggi": "Oggi", 
    "Ieri": "Aiere",
    "Ingrandisci": "Fa vedè gruoss", 
    "Ha preso un Malus Nascosto:": "Ha pigliat nu malus nascost",
    "Ha preso un Malus:": "Ha pigliat nu malus",
    "Ha preso un Bonus Nascosto:": "Ha pigliat nu bonus nascost",
    "Ha preso un Bonus:": "Ha pigliat nu bonus",
    "Oggi" : "Ogg",
    "Ieri" : "Aier",
    "La Tua Squadra": "A squadra toj",
    "Lista Matricole": "Tutti i muccusielli",
    "Richiedi Bonus" : "Chier o favor",
    "Richiedi": "Chier",
    "GIORNALIERO" : "Tutt e iuorn"
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
          if (docSnap.exists()) setUserData({ id: docSnap.id, ...docSnap.data() });
          setLoading(false);
        });

        try {
            const settings = await getSystemSettings();
            setSystemSettings(settings); 
            
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

  // --- TRIGGERS EASTER EGGS ---
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans relative">
      
      {/* OVERLAY TEMA GIALLO */}
      {yellowTheme && (
        <div 
            className="fixed inset-0 z-[9999] pointer-events-none animate-in fade-in duration-500"
            style={{
                backgroundColor: 'rgba(253, 224, 71, 0.4)', 
                mixBlendMode: 'color', 
                backdropFilter: 'sepia(100%)' 
            }}
        />
      )}

      {/* ICONA PIZZA NAPOLETANA */}
      {neapolitanMode && (
          <div className="fixed top-4 left-4 z-[50] animate-bounce pointer-events-none">
              <Pizza size={32} className="text-orange-500 drop-shadow-lg" />
          </div>
      )}

      {/* BLUR NEBBIA */}
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
                  {t(userData.role === 'matricola' ? 'Matricola' : (userData.role === 'super-admin' ? 'Super Admin' : 'Admin'))}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-500 hover:text-red-600 transition-colors">
              <LogOut size={18} />
          </button>
        </div>

        <TabContent id="feed" activeTab={activeTab}>
           <NewsFeed t={t}/>
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
                <BonusMalusList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            <TabContent id="percorso" activeTab={activeTab}>
                <StoricoPunti currentUser={userData} />
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
                 <BonusMalusList currentUser={userData} preloadedChallenges={globalChallenges} />
            </TabContent>

            {activeTab === 'admin-sfide' && isAdminOrSuper && <AdminSfideManager />}
            {activeTab === 'admin-utenti' && isSuperAdmin && <AdminUserList currentUser={userData} preloadedUsers={globalUsers} />}
          </>
        )}

      </div>

      {showProfile && user && (
          <EditProfile 
              user={userData} 
              onClose={() => setShowProfile(false)} 
              onUpdate={refreshUserData}
              isNeapolitan={neapolitanMode} 
              onToggleLanguage={triggerNeapolitan}
              t={t} 
          />
      )}
      
      {!isBlurActive && (
         <Navigation activeTab={activeTab} setActiveTab={setActiveTab} role={userData.role} t={t}/>
      )}
    </div>
  );
}
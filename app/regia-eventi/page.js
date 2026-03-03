'use client';

import { useState, useEffect } from 'react';
import { auth, db, getAllUsers, assignMatricolaToEventTeam, removeMatricolaFromEventTeam } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { LayoutDashboard, Wrench, MonitorPlay, Radio, Settings, ShieldAlert, Loader2, LogOut, Menu, X , ScanSearch} from 'lucide-react';

// IMPORT DEI COMPONENTI SEPARATI
import Login from '@/components/Login';
import DashboardClassifiche from '@/components/regia/DashboardClassifiche';
import SetupRegia from '@/components/regia/SetupRegia';
import LiveSfide from '@/components/regia/LiveSfide';
import Televoto from '@/components/regia/Televoto';

export default function PuntiLayout() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [activeView, setActiveView] = useState('home');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // --- NUOVO STATO: GESTISCE L'ESPANSIONE DELLA SIDEBAR DESKTOP ---
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

    const [eventTeams, setEventTeams] = useState([]);
    const [allMatricole, setAllMatricole] = useState([]);
    const [eventChallenges, setEventChallenges] = useState([]);
    const [liveVotingData, setLiveVotingData] = useState(null);
    const [eventPerformances, setEventPerformances] = useState([]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                const userRef = doc(db, 'users', firebaseUser.uid);
                const docSnap = await getDoc(userRef);
                if (docSnap.exists()) setUserData({ id: docSnap.id, ...docSnap.data() });
            } else { setUser(null); setUserData(null); }
            setLoading(false);
        });

        const qTeams = query(collection(db, 'event_teams'), orderBy('createdAt', 'asc'));
        const uTeams = onSnapshot(qTeams, (snap) => setEventTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qChal = query(collection(db, 'event_challenges'), orderBy('createdAt', 'desc'));
        const uChal = onSnapshot(qChal, (snap) => setEventChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const uVote = onSnapshot(doc(db, 'live_voting', 'current'), (docSnap) => setLiveVotingData(docSnap.exists() ? docSnap.data() : null));

        const qPerf = query(collection(db, 'event_performances'), orderBy('createdAt', 'asc'));
        const uPerf = onSnapshot(qPerf, (snap) => setEventPerformances(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        getAllUsers().then(users => setAllMatricole(users.filter(u => u.role === 'matricola')));

        return () => { unsubscribeAuth(); uTeams(); uChal(); uVote(); uPerf(); };
    }, []);

    const handleLogout = async () => { await signOut(auth); window.location.reload(); };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white"><Loader2 className="animate-spin" size={48} /></div>;
    if (!user) return <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4"><Login /></div>;
    if (!userData || userData.role !== 'super-admin') return <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white"><ShieldAlert size={80} className="text-red-500 mb-6"/><h1 className="text-3xl font-black">Accesso Negato</h1>
    <div><button onClick={handleLogout} className="mt-auto w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-4 rounded-2xl font-bold text-lg">
                        <LogOut size={20}/> Esci   
                    </button></div>
    </div>;

    const navItems = [
        { id: 'home', label: 'Classifica', icon: LayoutDashboard },
        { id: 'televoto', label: 'Televoto', icon: Radio },
        { id: 'live', label: 'Sfide Live', icon: MonitorPlay },
         { id: 'setup', label: 'Setup Serata', icon: Wrench },
        
    ];

    const changeView = (id) => {
        setActiveView(id);
        setMobileMenuOpen(false);
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col md:flex-row font-sans overflow-hidden">
            
            {/* SIDEBAR DESKTOP (A SCOMPARSA) */}
            {/* SIDEBAR DESKTOP (A SCOMPARSA) */}
            <aside 
                className={`bg-gray-950 border-r border-gray-800 hidden md:flex flex-col h-screen shrink-0 transition-all duration-300 ease-in-out z-20 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}
                onMouseEnter={() => setIsSidebarExpanded(true)}
                onMouseLeave={() => setIsSidebarExpanded(false)}
            >
                <div className={`h-20 flex items-center border-b border-gray-800 transition-all duration-300 ${isSidebarExpanded ? 'px-5 justify-start' : 'justify-center'}`}>
                    <div className="bg-[#B41F35] p-2 rounded-lg shrink-0">
                        <Settings size={24} />
                    </div>
                    <h1 className={`text-lg font-bold tracking-tight whitespace-nowrap transition-all duration-300 overflow-hidden ${isSidebarExpanded ? 'ml-4 opacity-100' : 'ml-0 opacity-0 w-0'}`}>
                        Regia
                    </h1>
                </div>
                
                <nav className="flex-1 px-3 space-y-3 mt-6">
                    {navItems.map(item => {
                        const isActive = activeView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => changeView(item.id)}
                                title={!isSidebarExpanded ? item.label : ''}
                                className={`w-full flex items-center py-3 rounded-xl font-bold transition-all duration-200 overflow-hidden
                                    ${isActive ? 'bg-[#B41F35] text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}
                                    ${isSidebarExpanded ? 'px-4 justify-start' : 'justify-center'}`}
                            >
                                <item.icon size={24} className="shrink-0" />
                                <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isSidebarExpanded ? 'ml-4 opacity-100' : 'ml-0 opacity-0 w-0'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button 
                        onClick={handleLogout} 
                        title={!isSidebarExpanded ? "Esci" : ""}
                        className={`w-full flex items-center py-3 rounded-xl font-bold transition-all duration-200 overflow-hidden bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white
                            ${isSidebarExpanded ? 'px-4 justify-start' : 'justify-center'}`}
                    >
                        <LogOut size={22} className="shrink-0 text-red-500/80"/>
                        <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isSidebarExpanded ? 'ml-4 opacity-100' : 'ml-0 opacity-0 w-0'}`}>
                            Disconnetti
                        </span>
                    </button>
                </div>
            </aside>
            {/* HEADER MOBILE */}
            <header className="md:hidden bg-gray-950 border-b border-gray-800 p-4 flex items-center justify-between z-50 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="bg-[#B41F35] p-1.5 rounded-lg"><Settings size={20} /></div>
                    <span className="font-bold">Regia</span>
                </div>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white p-2">
                    {mobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
                </button>
            </header>

            {/* MENU MOBILE OVERLAY */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 top-[73px] bg-gray-950 z-40 p-4 flex flex-col">
                     <nav className="space-y-3 flex-1">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => changeView(item.id)}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-lg transition-all ${activeView === item.id ? 'bg-[#B41F35] text-white' : 'bg-gray-900 text-gray-400'}`}
                            >
                                <item.icon size={24} />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    <button onClick={handleLogout} className="mt-auto w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-4 rounded-2xl font-bold text-lg">
                        <LogOut size={20}/> Esci
                    </button>
                </div>
            )}

            {/* AREA CONTENUTO PRINCIPALE */}
            <main className="flex-1 overflow-y-auto bg-gray-900 p-4 md:p-8 relative">
                <div className="max-w-6xl mx-auto pb-20">
                    {activeView === 'home' && <DashboardClassifiche eventTeams={eventTeams} />}
                    
                    {activeView === 'televoto' && (
                        <Televoto 
                            eventPerformances={eventPerformances} 
                            allMatricole={allMatricole} 
                            liveVotingData={liveVotingData} 
                        />
                    )}
                    
                    {activeView === 'live' && (
                        <LiveSfide 
                            eventTeams={eventTeams} 
                            eventChallenges={eventChallenges} 
                        />
                    )}
                    
                    

                    {activeView === 'setup' && (
                        <SetupRegia 
                            eventTeams={eventTeams} 
                            allMatricole={allMatricole} 
                            eventChallenges={eventChallenges}
                            onAssignMatricola={assignMatricolaToEventTeam}
                            onRemoveMatricola={removeMatricolaFromEventTeam}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
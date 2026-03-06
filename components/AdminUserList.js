'use client';

import { useState, useEffect } from 'react';
import { updateUserRole, deleteUserDocument, getSystemSettings, toggleRegistrations, updateCacheSettings, toggleMatricolaBlur, updateSystemSettings } from '@/lib/firebase';
import { Users, UserCheck, Crown, Trash2, Key, Search, Lock, Unlock, ShieldAlert, Zap, Clock, Save, Ghost, Wine, Shield, Eye } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getApprovedRequestsByUser } from '@/lib/firebase'; // <-- Aggiungi questa se manca!

export default function AdminUserList({ currentUser, preloadedUsers = [] , t}) {
    const tr = (text) => (t ? t(text) : text);
  const [users, setUsers] = useState(preloadedUsers);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); 

  // STATI SISTEMA
  const [regOpen, setRegOpen] = useState(true);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheDuration, setCacheDuration] = useState(30);
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [feedCacheEnabled, setFeedCacheEnabled] = useState(true);
  const [feedCacheDuration, setFeedCacheDuration] = useState(2);
  
  //pdf
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // STATI VISUALIZZAZIONE CLASSIFICHE
  const [showDrinkCount, setShowDrinkCount] = useState(true); 
  const [showSquadCount, setShowSquadCount] = useState(true); 
  const [showCaptainIcon, setShowCaptainIcon] = useState(true); 
  const [showEveningPoints, setShowEveningPoints] = useState(false); // <--- NUOVO STATO PUNTI SERATA (Default spento per sorpresa)
  
  const [settingsLoading, setSettingsLoading] = useState(true);

  const isSuperAdmin = currentUser?.role === 'super-admin';

  useEffect(() => {
    if (preloadedUsers.length > 0) setUsers(preloadedUsers);
  }, [preloadedUsers]);

  // Carica impostazioni
  useEffect(() => {
    if (isSuperAdmin) {
        const loadSettings = async () => {
            try {
                const settings = await getSystemSettings();
                setRegOpen(settings?.registrationsOpen ?? true);
                setCacheEnabled(settings?.cacheEnabled ?? true);
                setCacheDuration(settings?.cacheDuration ?? 30);
                setBlurEnabled(settings?.matricolaBlur ?? false);
                setMaintenanceMode(settings?.maintenanceMode ?? false);
                setFeedCacheEnabled(settings?.feedCacheEnabled ?? true);
                setFeedCacheDuration(settings?.feedCacheDuration ?? 2);
                
                setShowDrinkCount(settings?.showDrinkCount ?? true);
                setShowSquadCount(settings?.showSquadCount ?? true);
                setShowCaptainIcon(settings?.showCaptainIcon ?? true);
                setShowEveningPoints(settings?.showEveningPoints ?? false); // <--- CARICA IL NUOVO FLAG
            } catch (e) { console.error(e); }
            finally { setSettingsLoading(false); }
        };
        loadSettings();
    }
  }, [isSuperAdmin]);

  const handleToggleReg = async () => {
    const newState = !regOpen;
    setRegOpen(newState); 
    await toggleRegistrations(newState);
  };

  const saveCacheSettings = async (newEnabled, newDuration) => {
    setSettingsLoading(true);
    setCacheEnabled(newEnabled);
    try {
        await updateCacheSettings(newEnabled, newDuration);
    } catch (e) { 
        alert("Errore salvataggio settings");
        setCacheEnabled(!newEnabled);
    }
    finally { setSettingsLoading(false); }
  };

  const saveFeedCacheSettings = async (newEnabled, newDuration) => {
    setSettingsLoading(true);
    setFeedCacheEnabled(newEnabled);
    try {
        await updateSystemSettings({ feedCacheEnabled: newEnabled, feedCacheDuration: Number(newDuration) });
    } catch (e) { 
        alert("Errore salvataggio settings feed");
        setFeedCacheEnabled(!newEnabled);
    }
    finally { setSettingsLoading(false); }
  };

  const handleToggleBlur = async () => {
    const newState = !blurEnabled;
    setBlurEnabled(newState); 
    try {
        await toggleMatricolaBlur(newState);
    } catch (e) {
        alert("Errore aggiornamento blur");
        setBlurEnabled(!newState); 
    }
  };

  const handleToggleMaintenance = async () => {
    if (!confirm("ATTENZIONE: Stai per bloccare l'accesso all'app a tutti i non-admin. Confermi?")) return;
    const newState = !maintenanceMode;
    setMaintenanceMode(newState);
    try {
        await updateSystemSettings({ maintenanceMode: newState });
    } catch (e) {
        alert("Errore aggiornamento manutenzione");
        setMaintenanceMode(!newState);
    }
  };

  // FUNZIONE UNIFICATA: Salva i settings visivi delle classifiche
  const handleToggleVisualSetting = async (settingName, currentValue) => {
      const newState = !currentValue;
      
      // Aggiornamento ottimistico UI
      if (settingName === 'showDrinkCount') setShowDrinkCount(newState);
      if (settingName === 'showSquadCount') setShowSquadCount(newState);
      if (settingName === 'showCaptainIcon') setShowCaptainIcon(newState);
      if (settingName === 'showEveningPoints') setShowEveningPoints(newState); // <--- OTTIMISTICO NUOVO FLAG

      try {
          await updateSystemSettings({ [settingName]: newState });
      } catch (error) {
          alert("Errore salvataggio impostazione.");
          // Revert in caso di errore
          if (settingName === 'showDrinkCount') setShowDrinkCount(currentValue);
          if (settingName === 'showSquadCount') setShowSquadCount(currentValue);
          if (settingName === 'showCaptainIcon') setShowCaptainIcon(currentValue);
          if (settingName === 'showEveningPoints') setShowEveningPoints(currentValue); // <--- REVERT NUOVO FLAG
      }
  };


  const handleRoleChange = async (userId, newRole) => {
    if (!isSuperAdmin) return;
    setUpdatingUser(userId);
    try { 
        await updateUserRole(userId, newRole); 
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) { alert(e); }
    finally { setUpdatingUser(null); }
  };

  const handleDeleteUser = async (user) => {
    if (!isSuperAdmin) return;
    if (prompt(`Per eliminare ${user.displayName} scrivi ELIMINA:`) !== "ELIMINA") return;
    try { 
        await deleteUserDocument(user.id); 
        setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (e) { alert(e); }
  };

  const counts = users.reduce((acc, u) => {
    const r = u.role || 'sconosciuto';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, { matricola: 0, utente: 0, admin: 0, 'super-admin': 0 });

  const filteredUsers = users.filter(u => 
    (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const generaReportDettagliatoTutteMatricole = async () => {
    // Avviso di sicurezza per evitare click accidentali
    if (!confirm("Attenzione: Questa operazione scaricherà lo storico di TUTTE le matricole. Potrebbe richiedere qualche secondo. Procedere?")) return;

    setIsGeneratingPDF(true);
    
    try {
        const doc = new jsPDF();
        const brandColor = [180, 31, 53];

        // HEADER PRINCIPALE (Stampa solo sulla prima pagina)
        doc.setFillColor(...brandColor);
        doc.rect(0, 0, 210, 30, 'F'); 
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("STORICO DETTAGLIATO MATRICOLE", 14, 20);

        // Prendi solo le matricole e mettile in ordine di punteggio
        const matricole = users.filter(u => u.role === 'matricola').sort((a, b) => (b.punti || 0) - (a.punti || 0));

        let currentY = 40; // Punto di partenza dall'alto

        // Cicliamo ogni matricola per scaricare i dati e disegnare la sua tabella
        for (let i = 0; i < matricole.length; i++) {
            const m = matricole[i];
            
            // ⚠️ CHIAMATA A FIREBASE: Scarica lo storico di QUESTA matricola
            const storico = await getApprovedRequestsByUser(m.id);

            // Se stiamo arrivando a fine pagina, crea una pagina nuova
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            // 1. INTESTAZIONE MATRICOLA
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...brandColor);
            doc.text(`${i + 1}. ${m.displayName || 'Sconosciuto'}`, 14, currentY);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Totale Punti: ${m.punti || 0} | Squadra: ${m.teamName || 'Nessuna'}`, 14, currentY + 6);
            
            currentY += 12; // Spazio prima della tabella

            // 2. TABELLA STORICO
            if (storico.length === 0) {
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.setFont("helvetica", "italic");
                doc.text("Nessuna attività registrata per questa matricola.", 14, currentY);
                currentY += 15; // Spazio extra prima del prossimo utente
                continue; // Passa alla matricola successiva
            }

            // Prepara i dati della tabella
            const tableBody = storico.map(item => {
                const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
                const dataStr = dateObj.toLocaleDateString('it-IT') + ' ' + dateObj.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
                const isMalus = item.puntiRichiesti < 0;
                const puntiStr = isMalus ? `${item.puntiRichiesti}` : `+${item.puntiRichiesti}`;
                
                return [dataStr, item.challengeName || "Sfida", item.manual ? "Admin" : "App", puntiStr];
            });

            // Disegna la tabella
            autoTable(doc, {
                startY: currentY,
                head: [['Data', 'Azione / Bonus / Malus', 'Assegnato da', 'Punti']],
                body: tableBody,
                theme: 'striped',
                headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' }, // Header grigio scuro per staccare dal rosso
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 25, halign: 'center' },
                    3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 3) {
                        const val = parseInt(data.cell.raw);
                        if (val < 0) data.cell.styles.textColor = [220, 38, 38]; // Rosso
                        else data.cell.styles.textColor = [22, 163, 74]; // Verde
                    }
                },
            });

            // Aggiorna la Y per la matricola successiva: la tabella finisce a `doc.lastAutoTable.finalY`
            currentY = doc.lastAutoTable.finalY + 15; 
        }

        // FOOTER CON NUMERO PAGINE
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "normal");
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Report Globale Storici - Generato il: ${new Date().toLocaleString('it-IT')} - Pagina ${i} di ${pageCount}`, 14, 285);
        }

        // Salva
        doc.save(`Report_Dettagliato_Matricole.pdf`);

    } catch (error) {
        console.error("Errore generazione PDF Dettagliato:", error);
        alert("Errore durante la creazione del PDF. Controlla la console.");
    } finally {
        setIsGeneratingPDF(false); // Spegne l'icona di caricamento
    }
  };

  return (
    <div className="pb-20">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Users className="text-blue-600" /> Gestione Utenti
      </h2>

      {/* --- PANNELLO CONTROLLO SUPER ADMIN --- */}
      {isSuperAdmin && (
        <div className="space-y-4 mb-8">
            <button 
              onClick={generaReportDettagliatoTutteMatricole}
              disabled={isGeneratingPDF}
              className={`text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 ${isGeneratingPDF ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#B41F35] hover:bg-[#90192a] active:scale-95'}`}
          >
              {isGeneratingPDF ? (
                 <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> 
                    Generazione in corso...
                 </>
              ) : (
                 <>📄 Scarica Storico Completo</>
              )}
          </button>
            {/* BLOCCO 1: CONTROLLI SISTEMA */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                    
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-3 relative z-10">
                        <ShieldAlert className="text-yellow-400" size={20} />
                        <h3 className="font-bold text-lg leading-tight">{tr("System Control")}</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">

                        {/* ISCRIZIONI */}
                        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div>
                                <span className="block text-sm font-bold text-gray-200">Registrazioni</span>
                                <span className="text-[10px] text-gray-400">Permetti nuovi iscritti</span>
                            </div>
                            <button 
                                onClick={handleToggleReg}
                                disabled={settingsLoading}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${
                                    regOpen ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-red-500 text-white'
                                }`}
                            >
                                {regOpen ? <><Unlock size={14}/> ON</> : <><Lock size={14}/> OFF</>}
                            </button>
                        </div>

                        {/* BLACKOUT MATRICOLE */}
                        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div>
                                <span className="block text-sm font-bold text-gray-200 flex items-center gap-2">
                                    {tr("Blackout Matricole")} <Ghost size={14} className={blurEnabled ? "text-purple-400" : "text-gray-500"}/>
                                </span>
                                <span className="text-[10px] text-gray-400">Oscura il sito alle matricole</span>
                            </div>
                            <button 
                                onClick={handleToggleBlur}
                                disabled={settingsLoading}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${
                                    blurEnabled ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-gray-600 text-gray-300'
                                }`}
                            >
                                {blurEnabled ? tr('ATTIVO') : tr('SPENTO')}
                            </button>
                        </div>

                        {/* SEZIONE CACHE - titolo separatore */}
                        <div className="md:col-span-2 flex items-center gap-2 mt-2">
                            <div className="flex-1 h-px bg-slate-700"></div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
                                <Zap size={10}/> Gestione Cache
                            </span>
                            <div className="flex-1 h-px bg-slate-700"></div>
                        </div>

                        {/* CACHE DATI */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div className="flex items-center justify-between mb-1">
                                <div>
                                    <span className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                        Cache Dati <Zap size={14} className={cacheEnabled ? "text-yellow-400 fill-yellow-400" : "text-gray-500"}/>
                                    </span>
                                    <span className="text-[10px] text-gray-400">Risparmio letture DB globale</span>
                                </div>
                                <button 
                                    onClick={() => saveCacheSettings(!cacheEnabled, cacheDuration)}
                                    disabled={settingsLoading}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${
                                        cacheEnabled ? 'bg-blue-600 justify-end' : 'bg-gray-600 justify-start'
                                    }`}
                                >
                                    <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg mt-3">
                                <Clock size={14} className="text-slate-400"/>
                                <span className="text-xs text-slate-300">Reset ogni:</span>
                                <input 
                                    type="number" 
                                    value={cacheDuration}
                                    onChange={(e) => setCacheDuration(e.target.value)}
                                    className="w-12 bg-transparent text-center text-sm font-bold text-white border-b border-slate-600 focus:border-blue-500 outline-none"
                                />
                                <span className="text-xs text-slate-300">min</span>
                                <button onClick={() => saveCacheSettings(cacheEnabled, cacheDuration)} className="ml-auto text-blue-400 hover:text-white transition-colors">
                                    <Save size={16} />
                                </button>
                            </div>
                        </div>

                        {/* CACHE FEED + STORICO */}
                        <div className="bg-slate-800 p-4 rounded-xl border border-green-900/40">
                            <div className="flex items-center justify-between mb-1">
                                <div>
                                    <span className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                        Cache Feed <Clock size={14} className={feedCacheEnabled ? "text-green-400" : "text-gray-500"}/>
                                    </span>
                                    <span className="text-[10px] text-gray-400">Imposta cache sulle News</span>
                                </div>
                                <button 
                                    onClick={() => saveFeedCacheSettings(!feedCacheEnabled, feedCacheDuration)}
                                    disabled={settingsLoading}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${
                                        feedCacheEnabled ? 'bg-green-600 justify-end' : 'bg-gray-600 justify-start'
                                    }`}
                                >
                                    <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg mt-3">
                                <Clock size={14} className="text-slate-400"/>
                                <span className="text-xs text-slate-300">Reset ogni:</span>
                                <input 
                                    type="number" 
                                    value={feedCacheDuration}
                                    onChange={(e) => setFeedCacheDuration(e.target.value)}
                                    className="w-12 bg-transparent text-center text-sm font-bold text-white border-b border-slate-600 focus:border-green-500 outline-none"
                                />
                                <span className="text-xs text-slate-300">min</span>
                                <button onClick={() => saveFeedCacheSettings(feedCacheEnabled, feedCacheDuration)} className="ml-auto text-green-400 hover:text-white transition-colors">
                                    <Save size={16} />
                                </button>
                            </div>
                        </div>

                        {/* BLOCCA APP */}
                        <div className="flex items-center justify-between bg-red-900/20 p-4 rounded-xl border border-red-900/50 md:col-span-2">
                            <div>
                                <span className="text-sm font-bold text-red-400 flex items-center gap-2">
                                    <ShieldAlert size={14}/> Blocca l'app
                                </span>
                                <span className="text-[10px] text-gray-400">Chiude l'app a tutti i non-admin per preservare il DB</span>
                            </div>
                            <button 
                                onClick={handleToggleMaintenance}
                                disabled={settingsLoading}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wide transition-all ${
                                    maintenanceMode ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 animate-pulse' : 'bg-gray-700 text-gray-300'
                                }`}
                            >
                                {maintenanceMode ? 'BLOCCATO' : 'BLOCCA'}
                            </button>
                        </div>

                    </div>

            </div>

            {/* BLOCCO 2: IMPOSTAZIONI VISIVE CLASSIFICHE */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                     <Users className="text-blue-500" size={20} />
                     <h3 className="font-bold text-lg text-gray-900 leading-tight">Aspetto Classifiche</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    {/* TOGGLE DRINK */}
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <Wine size={16} className={showDrinkCount ? "text-purple-500" : "text-gray-400"}/>
                            <span className="text-xs font-bold text-gray-700">Contatore Cocktail</span>
                        </div>
                        <button 
                            onClick={() => handleToggleVisualSetting('showDrinkCount', showDrinkCount)}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center ${showDrinkCount ? 'bg-purple-500 justify-end' : 'bg-gray-300 justify-start'}`}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </button>
                    </div>

                    {/* TOGGLE SQUADRE */}
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <Shield size={16} className={showSquadCount ? "text-blue-500" : "text-gray-400"}/>
                            <span className="text-xs font-bold text-gray-700">Contatore Squadre</span>
                        </div>
                        <button 
                            onClick={() => handleToggleVisualSetting('showSquadCount', showSquadCount)}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center ${showSquadCount ? 'bg-blue-500 justify-end' : 'bg-gray-300 justify-start'}`}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </button>
                    </div>

                    {/* TOGGLE CAPITANI */}
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <Crown size={16} className={showCaptainIcon ? "text-yellow-500" : "text-gray-400"}/>
                            <span className="text-xs font-bold text-gray-700">Contatore Capitano</span>
                        </div>
                        <button 
                            onClick={() => handleToggleVisualSetting('showCaptainIcon', showCaptainIcon)}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center ${showCaptainIcon ? 'bg-yellow-500 justify-end' : 'bg-gray-300 justify-start'}`}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </button>
                    </div>
                    
                    {/* NUOVO: TOGGLE PUNTI SERATA */}
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <Eye size={16} className={showEveningPoints ? "text-emerald-500" : "text-gray-400"}/>
                            <span className="text-xs font-bold text-gray-700">Mostra Punti Serata</span>
                        </div>
                        <button 
                            onClick={() => handleToggleVisualSetting('showEveningPoints', showEveningPoints)}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors flex items-center ${showEveningPoints ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'}`}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </button>
                    </div>

                </div>
            </div>

        </div>
      )}

      {/* DASHBOARD CONTEGGI E LISTA UTENTI... (resto del codice identico) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: tr('Matricole'), count: counts.matricola, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: tr('Utenti'), count: counts.utente, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
            { label: tr('Admin'), count: counts.admin, icon: Key, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: tr('Super'), count: counts['super-admin'], icon: Crown, color: 'text-yellow-600', bg: 'bg-yellow-50' }
          ].map((stat, i) => (
             <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                 <div className={`${stat.bg} ${stat.color} p-2 rounded-full mb-1`}>
                    <stat.icon size={18} />
                 </div>
                 <span className="text-2xl font-black text-gray-900 leading-none">{stat.count || 0}</span>
                 <span className="text-[10px] font-bold text-gray-400 uppercase">{stat.label}</span>
             </div>
          ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
        <input 
            type="text" 
            placeholder="Cerca nome o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 p-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white shadow-sm transition-all"
        />
      </div>

      <div className="space-y-4">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
             
             <div className="p-4 flex items-start gap-3">
                <div className="relative">
                    <img src={user.photoURL || '/default-avatar.png'} className="w-12 h-12 rounded-full bg-gray-50 object-cover border border-gray-100" />
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white border-2 border-white ${
                        user.role === 'super-admin' ? 'bg-yellow-500' :
                        user.role === 'admin' ? 'bg-purple-500' :
                        user.role === 'matricola' ? 'bg-blue-500' : 'bg-gray-400'
                    }`}>
                        {user.role ? user.role[0].toUpperCase() : '?'}
                    </span>
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-gray-900 truncate text-base">{user.displayName || 'Senza Nome'}</h3>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        {isSuperAdmin && (
                            <button onClick={() => handleDeleteUser(user)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {user.teamName && (
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                Team: {user.teamName}
                            </span>
                        )}
                    </div>
                </div>
             </div>

             {isSuperAdmin && (
                 <div className="bg-gray-50 p-3 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-1 bg-gray-200/50 p-1 rounded-xl">
                        {['matricola', 'utente', 'admin', 'super-admin'].map(role => {
                            const isActive = user.role === role;
                            return (
                                <button 
                                    key={role} 
                                    onClick={() => handleRoleChange(user.id, role)} 
                                    disabled={isActive || updatingUser === user.id} 
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                        isActive 
                                        ? 'bg-white text-gray-900 shadow-sm scale-100' 
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 scale-95'
                                    }`}
                                >
                                    {role === 'super-admin' ? 'Super' : role === 'utente' ? 'Anziano' : role}
                                </button>
                            );
                        })}
                    </div>
                 </div>
             )}
          </div>
        ))}

        {filteredUsers.length === 0 && (
            <div className="text-center py-10">
                <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                    <Search className="text-gray-300" size={30}/>
                </div>
                <p className="text-gray-400 text-sm">Nessun utente trovato.</p>
            </div>
        )}
      </div>
    </div>
  );
}
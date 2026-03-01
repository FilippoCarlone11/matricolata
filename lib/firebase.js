import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  query, where, getDocs, onSnapshot, serverTimestamp, orderBy, runTransaction, limit, writeBatch, arrayRemove, arrayUnion, increment
} from 'firebase/firestore';

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ==========================================
// 1. AUTENTICAZIONE & GESTIONE UTENTI
// ==========================================

// Login Google
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  // SE L'UTENTE NON ESISTE (È UNA NUOVA ISCRIZIONE)
  if (!userSnap.exists()) {

    // 1. CONTROLLO SICUREZZA
    const settings = await getSystemSettings();
    if (!settings.registrationsOpen) {
      // Importante: Cancelliamo l'utente Auth perché non deve potersi registrare
      await user.delete().catch(e => console.log("Utente auth rimosso"));
      throw new Error("Le iscrizioni sono CHIUSE al momento.");
    }

    // 2. Se aperte, crea il profilo
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: 'matricola',
      punti: 0,
      mySquad: [],
      captainId: null,
      createdAt: serverTimestamp()
    });
  }
  return user;
};

// Registrazione Email/Password
export const registerWithEmail = async (name, email, password) => {
  // 1. CONTROLLO SICUREZZA: Le iscrizioni sono aperte?
  const settings = await getSystemSettings();
  if (!settings.registrationsOpen) {
    throw new Error("Le iscrizioni sono CHIUSE al momento.");
  }

  // 2. Se aperte, procedi...
  const res = await createUserWithEmailAndPassword(auth, email, password);
  const user = res.user;

  // Aggiorna nome su Auth
  await updateProfile(user, { displayName: name });

  // Crea documento su Firestore
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: email,
    displayName: name,
    photoURL: null,
    role: 'matricola',
    punti: 0,
    mySquad: [],
    captainId: null,
    createdAt: serverTimestamp()
  });

  return user;
};

// Login Email/Password
export const loginWithEmail = async (email, password) => {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
};

export const signOutUser = async () => await signOut(auth);

// Recupero dati utente singolo
export const getUserData = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
};

// Recupero tutti gli utenti (Statico)
export const getAllUsers = async () => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Aggiornamento Ruolo
export const updateUserRole = async (uid, newRole) => {
  await updateDoc(doc(db, 'users', uid), { role: newRole });
};

// Aggiornamento Profilo
export const updateUserProfile = async (userId, displayName, teamName, photoURL, isNeapolitan = false) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    displayName,
    teamName: teamName || '',
    photoURL,
    isNeapolitan: isNeapolitan // <--- Questo è fondamentale
  });
};

export const deleteUserDocument = async (userId) => {
  try {
    const batch = writeBatch(db);

    // 1. CANCELLA TUTTE LE RICHIESTE DELL'UTENTE
    const requestsRef = collection(db, 'requests');
    // Nota: Controlliamo sia 'matricolaId' che 'userId' per sicurezza (dipende da come le hai salvate)
    // Meglio fare due query separate o assicurarsi di usare sempre lo stesso campo.
    // Qui assumo che 'matricolaId' sia quello principale per le richieste punti.
    const qRequests = query(requestsRef, where('matricolaId', '==', userId));
    const requestSnap = await getDocs(qRequests);

    requestSnap.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 2. RIMUOVI UTENTE DALLE SQUADRE (mySquad) E RESETTA CAPITANO
    const usersRef = collection(db, 'users');
    const qSquads = query(usersRef, where('mySquad', 'array-contains', userId));
    const squadSnap = await getDocs(qSquads);

    squadSnap.forEach((doc) => {
      const allenatoreData = doc.data();
      const updates = {
        mySquad: arrayRemove(userId)
      };

      if (allenatoreData.captainId === userId) {
        updates.captainId = null;
      }

      batch.update(doc.ref, updates);
    });

    // 3. ELIMINA IL DOCUMENTO UTENTE
    const userDocRef = doc(db, 'users', userId);
    batch.delete(userDocRef);

    await batch.commit();
    console.log(`Utente ${userId} eliminato con successo.`);
    return true;

  } catch (error) {
    console.error("Errore cancellazione cascata:", error);
    throw error;
  }
};

// Listener Real-time Utenti
export const onUsersChange = (callback) => {
  const usersRef = collection(db, 'users');
  return onSnapshot(usersRef, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  });
};

// ==========================================
// 2. GESTIONE SFIDE (Bonus/Malus)
// ==========================================

export const createChallenge = async (challengeData) => {
  await addDoc(collection(db, 'challenges'), {
    ...challengeData,
    hidden: challengeData.hidden || false,
    createdAt: serverTimestamp()
  });
};

export const deleteChallenge = async (id) => {
  await deleteDoc(doc(db, 'challenges', id));
};

export const getChallenges = async () => {
  const snapshot = await getDocs(collection(db, 'challenges'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Aggiorna un bonus/malus nel catalogo
export const updateChallenge = async (id, data) => {
  const docRef = doc(db, 'challenges', id);
  await updateDoc(docRef, data);
};
// ==========================================
// 3. GESTIONE RICHIESTE & PUNTI
// ==========================================

// Creazione Richiesta (Con FOTO PROVA)
export const createRequest = async (matricolaId, challengeId, points, photoProof = null) => {
  await addDoc(collection(db, 'requests'), {
    matricolaId,
    challengeId,
    puntiRichiesti: points,
    photoProof: photoProof, // Salviamo la foto
    status: 'pending',
    createdAt: serverTimestamp()
  });
};

// Leggi richieste di un utente
export const getUserRequests = async (userId) => {
  const q = query(collection(db, 'requests'), where('matricolaId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Listener Richieste in Attesa (Admin)
export const onPendingRequestsChange = (callback) => {
  const q = query(collection(db, 'requests'), where('status', '==', 'pending'));
  return onSnapshot(q, async (snapshot) => {
    const requestsProm = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();

      // Recupero Dati Utente
      const targetUserId = data.matricolaId || data.userId;
      let userData = { displayName: 'Sconosciuto', photoURL: null };
      if (targetUserId) {
        try {
          const userSnap = await getDoc(doc(db, 'users', targetUserId));
          if (userSnap.exists()) userData = userSnap.data();
        } catch (e) { }
      }

      // Recupero Dati Sfida
      let challengeName = data.challengeName || data.challengeTitle || 'Sfida';
      let challengeIcon = '❓';

      if (data.challengeId) {
        try {
          const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
          if (cSnap.exists()) {
            const cData = cSnap.data();
            challengeName = cData.titolo;
            challengeIcon = cData.icon || '🏆';
          }
        } catch (e) { }
      }

      return {
        id: docSnap.id,
        ...data,
        matricolaId: targetUserId,
        userName: userData.displayName,
        userPhoto: userData.photoURL,
        challengeName,
        challengeIcon
      };
    });

    const results = await Promise.all(requestsProm);
    callback(results.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)));
  });
};

// Approva Richiesta
export const approveRequest = async (requestId, matricolaId, points) => {
  if (!matricolaId) throw new Error("ID Matricola mancante");
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'requests', requestId);
    const userRef = doc(db, 'users', matricolaId);

    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw "Utente non trovato";

    const currentPoints = userDoc.data().punti || 0;

    transaction.update(requestRef, { status: 'approved', approvedAt: serverTimestamp() });
    transaction.update(userRef, { punti: currentPoints + points });
  });
};

// Rifiuta Richiesta
export const rejectRequest = async (requestId) => {
  await updateDoc(doc(db, 'requests', requestId), { status: 'rejected', rejectedAt: serverTimestamp() });
};

// ==========================================
// 4. STORICO & AZIONI ADMIN
// ==========================================

export const getApprovedRequestsByUser = async (userId) => {
  const q = query(collection(db, 'requests'), where('matricolaId', '==', userId), where('status', '==', 'approved'));
  const snapshot = await getDocs(q);
  const requests = await Promise.all(snapshot.docs.map(async (docSnap) => {
    const data = docSnap.data();
    let challengeName = data.challengeTitle || data.challengeId;

    if (!data.challengeTitle && !data.manual && data.challengeId && data.challengeId.length > 15) {
      try {
        const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
        if (cSnap.exists()) challengeName = cSnap.data().titolo;
      } catch (e) { }
    }
    return { id: docSnap.id, ...data, challengeName };
  }));
  return requests.sort((a, b) => (b.approvedAt?.toDate() || 0) - (a.approvedAt?.toDate() || 0));
};

// Revoca Punti (Annulla approvazione)
export const revokeApprovedRequest = async (requestId, userId, points) => {
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'requests', requestId);
    const userRef = doc(db, 'users', userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw "Utente non trovato";

    transaction.update(requestRef, { status: 'revoked', revokedAt: serverTimestamp() });
    transaction.update(userRef, { punti: (userDoc.data().punti || 0) - points });
  });
};

// Assegnazione Manuale (Senza sfida esistente)
export const manualAddPoints = async (userId, points, reason) => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw "Utente non trovato";

    transaction.update(userRef, { punti: (userDoc.data().punti || 0) + points });

    const requestRef = doc(collection(db, 'requests'));
    transaction.set(requestRef, {
      matricolaId: userId,
      challengeId: reason || 'Bonus Manuale',
      challengeTitle: reason || 'Bonus Manuale',
      puntiRichiesti: points,
      status: 'approved', manual: true, approvedAt: serverTimestamp(), createdAt: serverTimestamp()
    });
  });
};

// Assegnazione Manuale di Sfida Esistente
export const assignExistingChallenge = async (userId, challengeId, points, title) => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw "Utente non trovato";

    transaction.update(userRef, { punti: (userDoc.data().punti || 0) + points });

    const requestRef = doc(collection(db, 'requests'));
    transaction.set(requestRef, {
      matricolaId: userId,
      challengeId: challengeId,
      challengeTitle: title,
      puntiRichiesti: points,
      status: 'approved',
      manual: true,
      approvedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  });
};

// ==========================================
// 5. MERCATO & SQUADRE
// ==========================================

export const getMarketStatus = async () => {
  const docSnap = await getDoc(doc(db, 'settings', 'config'));
  return docSnap.exists() ? docSnap.data().marketOpen : true;
};

export const toggleMarketStatus = async (isOpen) => {
  await setDoc(doc(db, 'settings', 'config'), { marketOpen: isOpen }, { merge: true });
};

export const getAvailableMatricole = async () => {
  const q = query(collection(db, 'users'), where('role', '==', 'matricola'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getFullSquadDetails = async (squadIds) => {
  if (!squadIds || squadIds.length === 0) return [];
  const squadDetails = [];
  for (const id of squadIds) {
    const docSnap = await getDoc(doc(db, 'users', id));
    if (docSnap.exists()) squadDetails.push({ id: docSnap.id, ...docSnap.data() });
  }
  return squadDetails;
};

// Compra Matricola
export const recruitMatricola = async (captainId, matricolaId) => {
  await runTransaction(db, async (transaction) => {
    const captainRef = doc(db, 'users', captainId);
    const matricolaRef = doc(db, 'users', matricolaId);
    const captainDoc = await transaction.get(captainRef);
    const matricolaDoc = await transaction.get(matricolaRef);
    if (!matricolaDoc.exists()) throw "Matricola non trovata";

    const captainData = captainDoc.data();
    const currentSquad = captainData.mySquad || [];

    if (currentSquad.length >= 3) throw "Hai già 3 matricole!";
    if (currentSquad.includes(matricolaId)) throw "Hai già questa matricola in rosa!";

    transaction.update(captainRef, { mySquad: [...currentSquad, matricolaId] });
  });
};

// Vendi Matricola
export const releaseMatricola = async (captainId, matricolaId) => {
  await runTransaction(db, async (transaction) => {
    const captainRef = doc(db, 'users', captainId);
    const captainDoc = await transaction.get(captainRef);
    const captainData = captainDoc.data();
    const newSquad = (captainData.mySquad || []).filter(id => id !== matricolaId);

    let newCaptainId = captainData.captainId;
    if (captainData.captainId === matricolaId) newCaptainId = null;

    transaction.update(captainRef, { mySquad: newSquad, captainId: newCaptainId });
  });
};

// Imposta Capitano
export const setSquadCaptain = async (userId, matricolaId) => {
  await updateDoc(doc(db, 'users', userId), { captainId: matricolaId });
};

// Calcolo Classifiche
export const getLeaderboards = async () => {
  const snapshot = await getDocs(collection(db, 'users'));
  const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const matricole = allUsers.filter(u => u.role === 'matricola').sort((a, b) => (b.punti || 0) - (a.punti || 0));

  const fantallenatori = allUsers
    .filter(u => u.role !== 'matricola')
    .map(allenatore => {
      let fantaPuntiTotali = 0;
      if (allenatore.mySquad) {
        allenatore.mySquad.forEach(mid => {
          const m = allUsers.find(u => u.id === mid);
          if (m) {
            const isCaptain = allenatore.captainId === mid;
            fantaPuntiTotali += (m.punti || 0) * (isCaptain ? 2 : 1);
          }
        });
      }
      return { ...allenatore, fantaPunti: fantaPuntiTotali };
    })
    .sort((a, b) => b.fantaPunti - a.fantaPunti);

  return { matricole, fantallenatori };
};

// ==========================================
// 6. GLOBAL FEED (Bacheca)
// ==========================================

export const getGlobalFeed = async () => {
  try {
    let q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(20));

    // Fallback: se 'createdAt' non esiste (vecchi dati), usa 'timestamp'
    let snapshot;
    try { snapshot = await getDocs(q); }
    catch (e) {
      q = query(collection(db, 'requests'), orderBy('timestamp', 'desc'), limit(20));
      snapshot = await getDocs(q);
    }

    const feedItems = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const targetUserId = data.matricolaId || data.userId;
      let userData = { displayName: 'Sconosciuto', photoURL: null };

      // 1. Recupera Info Utente
      if (targetUserId) {
        try {
          const userSnap = await getDoc(doc(db, 'users', targetUserId));
          if (userSnap.exists()) userData = userSnap.data();
        } catch (e) { }
      }

      // 2. Recupera Info Sfida (Nome + SE È NASCOSTA)
      let challengeName = data.challengeName || data.challengeTitle || data.challengeId;
      let isHidden = false; // Flag per sfide segrete

      // Se c'è un ID sfida, andiamo a leggere il doc originale per sapere se è hidden
      if (data.challengeId && data.challengeId.length > 15) {
        try {
          const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
          if (cSnap.exists()) {
            const cData = cSnap.data();
            if (!data.challengeTitle && !data.manual) challengeName = cData.titolo;
            isHidden = cData.hidden || false; // <--- ECCO LA MODIFICA RICHIESTA
          }
        } catch (e) { }
      }

      return {
        id: docSnap.id,
        ...data,
        timestamp: data.createdAt || data.timestamp || data.approvedAt,
        userName: userData.displayName || 'Utente',
        userPhoto: userData.photoURL,
        challengeName,
        isHidden // Passiamo l'info al frontend
      };
    }));

    return feedItems;
  } catch (error) {
    console.error("Errore feed:", error);
    return [];
  }
};

export const getSystemSettings = async () => {
  try {
    const docRef = doc(db, 'config', 'appSettings');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      const defaults = {
        registrationsOpen: true,
        cacheEnabled: true,
        cacheDuration: 30,
        matricolaBlur: false // <--- NUOVO CAMPO DEFAULT
      };
      await setDoc(docRef, defaults);
      return defaults;
    }
  } catch (error) {
    console.error("Errore lettura settings:", error);
    return { registrationsOpen: true, cacheEnabled: true, cacheDuration: 30, matricolaBlur: false };
  }
};

// NUOVA FUNZIONE: Toggle Blur
export const toggleMatricolaBlur = async (isBlur) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, { matricolaBlur: isBlur }, { merge: true });
};

export const toggleRegistrations = async (isOpen) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, { registrationsOpen: isOpen }, { merge: true });
};

// Funzione unificata per salvare Cache e Durata nello stesso posto delle registrazioni
export const updateCacheSettings = async (isEnabled, duration) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, {
    cacheEnabled: isEnabled,
    cacheDuration: parseInt(duration) || 30
  }, { merge: true });
};

// ==========================================
// 🎤 GESTIONE EVENTO DAL VIVO (REGIA)
// ==========================================

// 1. Crea una nuova squadra per la serata
export const createEventTeam = async (name, colorClass) => {
  await addDoc(collection(db, 'event_teams'), {
    name,
    colorClass,
    score: 0,
    members: [], // Qui salveremo gli ID delle matricole
    createdAt: serverTimestamp()
  });
};

// 2. Elimina una squadra
export const deleteEventTeam = async (teamId) => {
  await deleteDoc(doc(db, 'event_teams', teamId));
};

// 3. Aggiungi una matricola alla squadra della serata
export const assignMatricolaToEventTeam = async (teamId, userId) => {
  const teamRef = doc(db, 'event_teams', teamId);
  await updateDoc(teamRef, {
    members: arrayUnion(userId)
  });
};

// 4. Rimuovi una matricola dalla squadra della serata
export const removeMatricolaFromEventTeam = async (teamId, userId) => {
  const teamRef = doc(db, 'event_teams', teamId);
  await updateDoc(teamRef, {
    members: arrayRemove(userId)
  });
};

// ==========================================
// 🏆 GESTIONE SFIDE SERATA E CLASSIFICHE AUTOMATICHE
// ==========================================

export const createEventChallenge = async (title, p1, p2, p3) => {
  await addDoc(collection(db, 'event_challenges'), {
    title,
    pointsScheme: [p1, p2, p3],
    status: 'active',
    createdAt: serverTimestamp()
  });
};

export const deleteEventChallenge = async (challengeId) => {
  await deleteDoc(doc(db, 'event_challenges', challengeId));
};

// --- NUOVA LOGICA: RISOLUZIONE CON PAREGGI (EX AEQUO) ---
export const resolveEventChallenge = async (challengeId, teamRawScores, pointsScheme) => {
  const batch = writeBatch(db);

  // 1. Mettiamo le squadre in un array e le ordiniamo dal punteggio più alto al più basso
  const teamsArray = Object.keys(teamRawScores).map(teamId => ({
    teamId,
    rawScore: Number(teamRawScores[teamId] || 0)
  })).sort((a, b) => b.rawScore - a.rawScore);

  // 2. Raggruppiamo le squadre che hanno fatto lo STESSO punteggio
  const scoreGroups = {};
  teamsArray.forEach(t => {
    if (!scoreGroups[t.rawScore]) scoreGroups[t.rawScore] = [];
    scoreGroups[t.rawScore].push(t);
  });

  // Otteniamo i punteggi univoci ordinati
  const distinctScores = Object.keys(scoreGroups).map(Number).sort((a, b) => b - a);

  const finalResults = [];
  let currentRankIndex = 0; // Tiene traccia dei "premi" da assegnare (0=150, 1=100, 2=50)

  // 3. Assegniamo i punti gruppo per gruppo
  distinctScores.forEach(score => {
    const tiedTeams = scoreGroups[score];
    const numTied = tiedTeams.length; // Quante squadre hanno pareggiato a questo punteggio?

    // Calcoliamo il totale dei premi spettanti a questo gruppo
    let totalPointsForGroup = 0;
    for (let i = 0; i < numTied; i++) {
      totalPointsForGroup += (pointsScheme[currentRankIndex + i] || 0);
    }

    // Dividiamo i premi equamente (media)
    const averagePoints = Math.round(totalPointsForGroup / numTied);

    // Salviamo i risultati per ogni squadra del gruppo
    tiedTeams.forEach(team => {
      finalResults.push({
        teamId: team.teamId,
        rawScore: score,
        earnedPoints: averagePoints,
        rank: currentRankIndex + 1 // Mostra a schermo il "posto" in classifica
      });

      // Se hanno guadagnato punti, li aggiungiamo al totale della squadra!
      if (averagePoints > 0) {
        const teamRef = doc(db, 'event_teams', team.teamId);
        batch.update(teamRef, { score: increment(averagePoints) });
      }
    });

    // Passiamo ai premi successivi
    currentRankIndex += numTied;
  });

  // 4. Salviamo lo stato della sfida come completato
  const challengeRef = doc(db, 'event_challenges', challengeId);
  batch.update(challengeRef, {
    status: 'completed',
    finalResults: finalResults
  });

  await batch.commit();
};

// --- NUOVA FUNZIONE: RIAPRI UNA SFIDA E SOTTRAI I PUNTI ---
export const revertEventChallenge = async (challengeId) => {
  const challengeRef = doc(db, 'event_challenges', challengeId);
  const challengeSnap = await getDoc(challengeRef);

  if (!challengeSnap.exists()) return;
  const challengeData = challengeSnap.data();

  if (challengeData.status !== 'completed' || !challengeData.finalResults) return;

  const batch = writeBatch(db);

  // Per ogni squadra che aveva preso punti, li togliamo
  challengeData.finalResults.forEach(res => {
    if (res.earnedPoints > 0 && res.teamId) {
      const teamRef = doc(db, 'event_teams', res.teamId);
      batch.update(teamRef, { score: increment(-res.earnedPoints) });
    }
  });

  // Rimettiamo la sfida su "active" e puliamo i vecchi risultati
  batch.update(challengeRef, {
    status: 'active',
    finalResults: null
  });

  await batch.commit();
};

export const addManualPointsToEventTeams = async (teamPoints) => {
  const batch = writeBatch(db);

  for (const [teamId, points] of Object.entries(teamPoints)) {
    const numPoints = Number(points);
    if (numPoints !== 0) {
      const teamRef = doc(db, 'event_teams', teamId);
      batch.update(teamRef, { score: increment(numPoints) });
    }
  }

  await batch.commit();
};

// Aggiorna il nome di una squadra della serata
export const updateEventTeamName = async (teamId, newName) => {
  const teamRef = doc(db, 'event_teams', teamId);
  await updateDoc(teamRef, { name: newName });
};

// ==========================================
// ⚙️ IMPOSTAZIONI DI SISTEMA (UI E TOGGLES)
// ==========================================

export const updateSystemSettings = async (newSettings) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, newSettings, { merge: true });
};

// 📺 TELEVOTO IN TEMPO REALE (EVOLUTO CON SCALETTA)
// ==========================================
// LOGICA PUNTEGGI:
//   - totalScore = SOMMA di tutti i voti del pubblico per quell'esibizione
//   - Propaga al Fanta = aggiunge la SOMMA ai punti personali della matricola
//   - Assegna alle Squadre = calcola la MEDIA delle SOMME dei membri di ogni squadra

// 📋 FETCH SQUADRE — recupera tutte le squadre da event_teams
export const getEventTeams = async () => {
  const snap = await getDocs(collection(db, 'event_teams'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// 💣 RESET TOTALE TELEVOTO
// Esegue un rollback completo di TUTTE le esibizioni della serata:
//   1. Sottrae i punti Fanta da ogni utente che aveva ricevuto la propagazione
//   2. Cancella tutti i documenti `requests` creati dai televoti
//   3. Sottrae i punti classifica da ogni squadra che li aveva ricevuti
//   4. Rimette tutte le esibizioni in pending con score 0
//   5. Cancella il semaforo live se attivo
export const fullResetTelvoto = async () => {
  const batch = writeBatch(db);

  // 1. Tutte le esibizioni (qualsiasi stato)
  const perfSnap = await getDocs(collection(db, 'event_performances'));

  // 2. Squadre (per rollback classifica)
  const teamsSnap = await getDocs(collection(db, 'event_teams'));
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  for (const pDoc of perfSnap.docs) {
    const perf = pDoc.data();

    if (perf.fantaPropagated && perf.totalScore > 0) {
      if (perf.isTeam && perf.teamId) {
        const teamSnap = await getDoc(doc(db, 'event_teams', perf.teamId));
        const members = teamSnap.exists() ? (teamSnap.data().members || []) : [];
        for (const memberId of members) {
          batch.update(doc(db, 'users', memberId), { punti: increment(-perf.totalScore) });
          const rSnap = await getDocs(query(
            collection(db, 'requests'),
            where('challengeId', '==', `televoto_${pDoc.id}_${memberId}`)
          ));
          rSnap.forEach(d => batch.delete(d.ref));
        }
      } else if (perf.matricolaId) {
        batch.update(doc(db, 'users', perf.matricolaId), { punti: increment(-perf.totalScore) });
        const rSnap = await getDocs(query(
          collection(db, 'requests'),
          where('challengeId', '==', `televoto_${pDoc.id}`)
        ));
        rSnap.forEach(d => batch.delete(d.ref));
      }
    }

    // Rollback punti classifica
    if (perf.pointsAssigned && perf.totalScore > 0) {
      let targetTeamId = null;
      if (perf.isTeam && perf.teamId) {
        targetTeamId = perf.teamId;
      } else if (perf.matricolaId) {
        const t = teams.find(t => (t.members || []).includes(perf.matricolaId));
        if (t) targetTeamId = t.id;
      }
      if (targetTeamId) {
        batch.update(doc(db, 'event_teams', targetTeamId), { score: increment(-perf.totalScore) });
      }
    }

    // Reset esibizione → pending
    batch.update(pDoc.ref, {
      status: 'pending',
      totalScore: 0,
      votersCount: 0,
      fantaPropagated: false,
      pointsAssigned: false,
    });
  }

  // 3. Cancella semaforo live se esiste
  const liveRef = doc(db, 'live_voting', 'current');
  const liveSnap = await getDoc(liveRef);
  if (liveSnap.exists()) batch.delete(liveRef);

  await batch.commit();
  return perfSnap.size; // numero di esibizioni resettate
};

// Aggiunge un'esibizione alla scaletta (supporta sia Matricola che Squadra)
export const addEventPerformance = async (entityId, entityName, theme, isTeam = false) => {
  await addDoc(collection(db, 'event_performances'), {
    matricolaId: isTeam ? null : entityId,
    teamId: isTeam ? entityId : null,
    matricolaName: isTeam ? `SQUADRA: ${entityName}` : entityName,
    isTeam,
    theme,
    status: 'pending',
    totalScore: 0,
    votersCount: 0,
    pointsAssigned: false,
    fantaPropagated: false,
    createdAt: serverTimestamp()
  });
};

// Elimina un'esibizione dalla scaletta
export const deleteEventPerformance = async (performanceId) => {
  await deleteDoc(doc(db, 'event_performances', performanceId));
};

// Resetta un'esibizione conclusa per poterla rifare
export const resetEventPerformance = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  await updateDoc(perfRef, {
    status: 'pending',
    totalScore: 0,
    votersCount: 0,
    pointsAssigned: false,
    fantaPropagated: false
  });
};

// Inizia un'esibizione dalla scaletta
export const startEventPerformance = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);

  if (!perfSnap.exists()) return;
  const data = perfSnap.data();

  const batch = writeBatch(db);

  // 1. Reset di eventuali altre esibizioni 'active' (per sicurezza — le chiude come completed)
  const qActive = query(collection(db, 'event_performances'), where('status', '==', 'active'));
  const activeSnap = await getDocs(qActive);
  activeSnap.forEach(d => {
    batch.update(d.ref, { status: 'pending' }); // Le rimette in pending, non le perde
  });

  // 2. Imposta questa come active
  batch.update(perfRef, { status: 'active' });

  // 3. Sincronizza il documento semaforo per i popup
  const liveRef = doc(db, 'live_voting', 'current');
  batch.set(liveRef, {
    isActive: true,
    votingOpen: false,
    performanceId: performanceId,
    matricolaId: data.matricolaId,
    teamId: data.teamId ?? null,
    isTeam: data.isTeam ?? false,
    matricolaName: data.matricolaName,
    theme: data.theme,
    votes: {}
  });

  await batch.commit();
};

// Apre il televoto al pubblico
export const openLiveVoting = async () => {
  const liveRef = doc(db, 'live_voting', 'current');
  await updateDoc(liveRef, { votingOpen: true });
};

// Invia il voto di un utente
export const submitLiveVote = async (userId, voteValue) => {
  const liveRef = doc(db, 'live_voting', 'current');
  await updateDoc(liveRef, {
    [`votes.${userId}`]: voteValue
  });
};

// 🔴 ANNULLA un'esibizione LIVE — chiude il popup e rimette in coda (pending)
export const cancelLivePerformance = async () => {
  const liveRef = doc(db, 'live_voting', 'current');
  const liveSnap = await getDoc(liveRef);
  if (!liveSnap.exists()) return;

  const { performanceId } = liveSnap.data();
  const batch = writeBatch(db);

  // Rimette l'esibizione in coda come pending, azzerando eventuali voti parziali
  if (performanceId) {
    const perfRef = doc(db, 'event_performances', performanceId);
    batch.update(perfRef, {
      status: 'pending',
      totalScore: 0,
      votersCount: 0
    });
  }

  // Elimina il semaforo live (chiude il popup a tutti)
  batch.delete(liveRef);

  await batch.commit();
};

// ✅ CHIUDE e SALVA un'esibizione live con la SOMMA dei voti
export const completeEventPerformance = async (performanceId) => {
  const liveRef = doc(db, 'live_voting', 'current');
  const liveSnap = await getDoc(liveRef);
  if (!liveSnap.exists()) return;

  const data = liveSnap.data();
  const votes = Object.values(data.votes || {});
  const totalSum = votes.reduce((a, b) => a + Number(b), 0); // SOMMA — non media

  const batch = writeBatch(db);
  const perfRef = doc(db, 'event_performances', performanceId);

  batch.update(perfRef, {
    status: 'completed',
    totalScore: totalSum,       // SOMMA di tutti i voti del pubblico
    votersCount: votes.length
  });

  batch.delete(liveRef); // Chiude il popup a tutti
  await batch.commit();
};

// 🌟 PROPAGA SOMMA AL FANTA
// — Matricola individuale: crea 1 requests + incrementa punti dell'utente
// — Squadra: incrementa punti di OGNI membro (somma intera a ciascuno)
//            + crea 1 solo documento requests con teamId come riferimento
export const propagateSinglePerformanceToFanta = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);
  if (!perfSnap.exists()) throw new Error("Esibizione non trovata.");

  const perfData = perfSnap.data();
  if (perfData.fantaPropagated) throw new Error("Punti già propagati al Fanta per questa esibizione!");

  const batch = writeBatch(db);

  if (perfData.isTeam) {
    // ── Esibizione di SQUADRA ──────────────────────────────────────────────
    if (!perfData.teamId) throw new Error("teamId mancante su questa esibizione di squadra.");

    const teamSnap = await getDoc(doc(db, 'event_teams', perfData.teamId));
    if (!teamSnap.exists()) throw new Error("Squadra non trovata in event_teams.");

    const members = teamSnap.data().members || [];
    if (members.length === 0) throw new Error("La squadra non ha membri registrati.");

    // Un documento requests SEPARATO per ogni membro → rollback granulare sul singolo profilo
    members.forEach(memberId => {
      batch.update(doc(db, 'users', memberId), { punti: increment(perfData.totalScore) });

      const requestRef = doc(collection(db, 'requests'));
      batch.set(requestRef, {
        matricolaId:    memberId,                               // ID del singolo membro
        challengeId:    `televoto_${performanceId}_${memberId}`,// univoco per membro
        challengeTitle: `Televoto Squadra: ${perfData.theme}`,
        puntiRichiesti: perfData.totalScore,
        teamId:         perfData.teamId,                        // riferimento alla squadra
        status:         'approved',
        manual:         true,
        approvedAt:     serverTimestamp(),
        createdAt:      serverTimestamp(),
      });
    });

  } else {
    // ── Esibizione INDIVIDUALE ─────────────────────────────────────────────
    if (!perfData.matricolaId) throw new Error("Nessuna matricola associata a questa esibizione.");

    // Incrementa punti personali
    const userRef = doc(db, 'users', perfData.matricolaId);
    batch.update(userRef, { punti: increment(perfData.totalScore) });

    // Documento requests nel feed
    const requestRef = doc(collection(db, 'requests'));
    batch.set(requestRef, {
      matricolaId:    perfData.matricolaId,
      challengeId:    `televoto_${performanceId}`,
      challengeTitle: `Televoto: ${perfData.theme}`,
      puntiRichiesti: perfData.totalScore,
      status:         'approved',
      manual:         true,
      approvedAt:     serverTimestamp(),
      createdAt:      serverTimestamp(),
    });
  }

  // Blocca ulteriori propagazioni
  batch.update(perfRef, { fantaPropagated: true });

  await batch.commit();
};

// ↩️ ROLLBACK FANTA — sottrae i punti e cancella il documento `requests` associato
// — Matricola: sottrae totalScore dall'utente
// — Squadra: sottrae totalScore da OGNI membro della squadra
export const rollbackFantaPropagation = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);
  if (!perfSnap.exists()) throw new Error("Esibizione non trovata.");

  const perfData = perfSnap.data();
  if (!perfData.fantaPropagated) throw new Error("Questa esibizione non ha ancora propagato punti al Fanta.");
  if (perfData.totalScore === 0) throw new Error("Il punteggio è 0, nessun punto da sottrarre.");

  // Trova il documento requests tramite challengeId univoco
  const requestsSnap = await getDocs(query(
    collection(db, 'requests'),
    where('challengeId', '==', `televoto_${performanceId}`)
  ));

  const batch = writeBatch(db);

  if (perfData.isTeam) {
    // ── Rollback SQUADRA: sottrae punti da ogni membro e cancella il suo requests ──
    if (!perfData.teamId) throw new Error("teamId mancante.");
    const teamSnap = await getDoc(doc(db, 'event_teams', perfData.teamId));
    const members = teamSnap.exists() ? (teamSnap.data().members || []) : [];

    for (const memberId of members) {
      batch.update(doc(db, 'users', memberId), { punti: increment(-perfData.totalScore) });

      // Ogni membro ha il suo requests con challengeId univoco
      const rSnap = await getDocs(query(
        collection(db, 'requests'),
        where('challengeId', '==', `televoto_${performanceId}_${memberId}`)
      ));
      rSnap.forEach(d => batch.delete(d.ref));
    }

  } else {
    // ── Rollback INDIVIDUALE ───────────────────────────────────────────────
    if (!perfData.matricolaId) throw new Error("Nessuna matricola associata.");
    batch.update(doc(db, 'users', perfData.matricolaId), { punti: increment(-perfData.totalScore) });
  }

  // Cancella il documento requests dal feed
  requestsSnap.forEach(d => batch.delete(d.ref));

  // Sblocca il flag
  batch.update(perfRef, { fantaPropagated: false });

  await batch.commit();
};

// 🔁 RIPETI TELEVOTO — resetta l'esibizione sovrascrivendo il vecchio punteggio.
// Se i punti erano stati propagati al Fanta, esegue il rollback completo automaticamente.
export const repeatPerformanceTelvoto = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);
  if (!perfSnap.exists()) throw new Error("Esibizione non trovata.");

  const perfData = perfSnap.data();
  const batch = writeBatch(db);

  // Rollback Fanta se necessario
  if (perfData.fantaPropagated && perfData.totalScore > 0) {
    if (perfData.isTeam && perfData.teamId) {
      const teamSnap = await getDoc(doc(db, 'event_teams', perfData.teamId));
      const members = teamSnap.exists() ? (teamSnap.data().members || []) : [];
      for (const memberId of members) {
        batch.update(doc(db, 'users', memberId), { punti: increment(-perfData.totalScore) });
        const rSnap = await getDocs(query(
          collection(db, 'requests'),
          where('challengeId', '==', `televoto_${performanceId}_${memberId}`)
        ));
        rSnap.forEach(d => batch.delete(d.ref));
      }
    } else if (perfData.matricolaId) {
      batch.update(doc(db, 'users', perfData.matricolaId), { punti: increment(-perfData.totalScore) });
      const rSnap = await getDocs(query(
        collection(db, 'requests'),
        where('challengeId', '==', `televoto_${performanceId}`)
      ));
      rSnap.forEach(d => batch.delete(d.ref));
    }
  }

  // Rimette in coda azzerando tutto
  batch.update(perfRef, {
    status: 'pending',
    totalScore: 0,
    votersCount: 0,
    fantaPropagated: false,
    pointsAssigned: false,
  });

  await batch.commit();
};

// 🏆 ASSEGNAZIONE FINALE PUNTI ALLE SQUADRE
// Logica: MEDIA delle SOMME ottenute dai membri di ogni squadra
// Esempio: Matricola A = 100 punti, Matricola B = 200 punti → Squadra riceve 150 punti
export const assignAllPerformancePoints = async () => {
  // 1. Recupera tutte le esibizioni completate e non ancora assegnate
  const q = query(
    collection(db, 'event_performances'),
    where('status', '==', 'completed'),
    where('pointsAssigned', '==', false)
  );
  const perfSnap = await getDocs(q);

  if (perfSnap.empty) throw new Error("Nessun punto da assegnare, o già tutti assegnati.");

  // 2. Recupera le squadre
  const teamsSnap = await getDocs(collection(db, 'event_teams'));
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 3. Raggruppa le SOMME per squadra
  //    teamAccumulator = { teamId: { totalSum: number, count: number } }
  const teamAccumulator = {};

  perfSnap.docs.forEach(pDoc => {
    const perf = pDoc.data();

    let targetTeamId = null;

    if (perf.isTeam && perf.teamId) {
      // Esibizione di squadra → va direttamente a quella squadra
      targetTeamId = perf.teamId;
    } else if (perf.matricolaId) {
      // Esibizione individuale → trova la squadra che contiene questa matricola
      const targetTeam = teams.find(t => (t.members || []).includes(perf.matricolaId));
      if (targetTeam) targetTeamId = targetTeam.id;
    }

    if (targetTeamId && perf.totalScore > 0) {
      if (!teamAccumulator[targetTeamId]) {
        teamAccumulator[targetTeamId] = { totalSum: 0, count: 0 };
      }
      teamAccumulator[targetTeamId].totalSum += perf.totalScore;
      teamAccumulator[targetTeamId].count += 1;
    }
  });

  // 4. Calcola la MEDIA per ogni squadra e assegna i punti
  const batch = writeBatch(db);
  let assignmentsCount = 0;

  for (const [teamId, { totalSum, count }] of Object.entries(teamAccumulator)) {
    const mediaArrotondata = Math.round(totalSum / count); // MEDIA delle SOMME, arrotondata
    const teamRef = doc(db, 'event_teams', teamId);
    batch.update(teamRef, { score: increment(mediaArrotondata) });
    assignmentsCount++;
  }

  // 5. Segna tutte le esibizioni come "punti assegnati"
  perfSnap.docs.forEach(pDoc => {
    batch.update(pDoc.ref, { pointsAssigned: true });
  });

  await batch.commit();
  return assignmentsCount;
};
// ==========================================
// 🔗 PROPAGAZIONE AL FANTAMATRICOLA
// ==========================================

export const propagateChallengeToFanta = async (challengeId) => {
  const challengeRef = doc(db, 'event_challenges', challengeId);
  const challengeSnap = await getDoc(challengeRef);

  if (!challengeSnap.exists()) throw new Error("Sfida non trovata.");
  const challengeData = challengeSnap.data();

  if (challengeData.status !== 'completed' || !challengeData.finalResults) {
    throw new Error("La sfida deve essere completata per propagare i punti.");
  }
  if (challengeData.fantaPropagated) {
    throw new Error("Punti già propagati per questa sfida.");
  }

  // 1. Identifica le squadre prime e ultime classificate
  const results = challengeData.finalResults;
  const minRank = Math.min(...results.map(r => r.rank));
  const maxRank = Math.max(...results.map(r => r.rank));

  const winningTeamIds = results.filter(r => r.rank === minRank).map(r => r.teamId);
  const losingTeamIds = results.filter(r => r.rank === maxRank).map(r => r.teamId);

  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  
  // Helper per recuperare i membri
  const getTeamMembers = async (teamId) => {
      const tSnap = await getDoc(doc(db, 'event_teams', teamId));
      return tSnap.exists() ? (tSnap.data().members || []) : [];
  };

  // Helper per la transazione
  const prepareMatricolaUpdate = async (userId, points, isWinner) => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const currentPoints = userSnap.data().punti || 0;
      batch.update(userRef, { punti: currentPoints + points });

      // Crea record nello storico
      const requestRef = doc(collection(db, 'requests'));
      const statusText = isWinner ? '1° Posto' : 'Ultimo Posto';
      batch.set(requestRef, {
        matricolaId: userId,
        challengeId: challengeId,
        challengeTitle: `Evento - ${challengeData.title}: ${statusText}`,
        puntiRichiesti: points,
        status: 'approved',
        manual: true,
        approvedAt: timestamp,
        createdAt: timestamp
      });
  };

  // 2. Vincitori (+5)
  for (const teamId of winningTeamIds) {
      const members = await getTeamMembers(teamId);
      for (const userId of members) {
          await prepareMatricolaUpdate(userId, 5, true);
      }
  }

  // 3. Perdenti (-5)
  if (minRank !== maxRank) {
      for (const teamId of losingTeamIds) {
          const members = await getTeamMembers(teamId);
          for (const userId of members) {
              await prepareMatricolaUpdate(userId, -5, false);
          }
      }
  }

  // 4. Segna come propagata
  batch.update(challengeRef, { fantaPropagated: true });
  await batch.commit();
};

// ==========================================
// ⏪ REVERT PROPAGAZIONE
// ==========================================

export const revertFantaPropagation = async (challengeId) => {
  const challengeRef = doc(db, 'event_challenges', challengeId);
  const qRequests = query(collection(db, 'requests'), where('challengeId', '==', challengeId));
  const reqSnap = await getDocs(qRequests);

  const batch = writeBatch(db);

  // 1. Togli i punti e cancella il feed
  for (const reqDoc of reqSnap.docs) {
    const data = reqDoc.data();
    if (data.manual && data.challengeTitle?.startsWith('Evento -')) {
      const userRef = doc(db, 'users', data.matricolaId);
      batch.update(userRef, { punti: increment(-data.puntiRichiesti) });
      batch.delete(reqDoc.ref);
    }
  }

  // 2. Resetta il flag
  batch.update(challengeRef, { fantaPropagated: false });
  await batch.commit();
};

// ==========================================
// 🏆 PROPAGAZIONE CLASSIFICA FINALE SERATA
// ==========================================
export const propagateFinalLeaderboard = async () => {
    const qTeams = query(collection(db, 'event_teams'));
    const snap = await getDocs(qTeams);
    const teams = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (teams.length === 0) throw new Error("Nessuna squadra trovata.");

    // Ordina per punteggio (dal più alto al più basso)
    teams.sort((a, b) => b.score - a.score);

    // Raggruppa per punteggio (per gestire i pareggi in modo equo)
    const scoreGroups = {};
    teams.forEach(t => {
        if (!scoreGroups[t.score]) scoreGroups[t.score] = [];
        scoreGroups[t.score].push(t);
    });

    const distinctScores = Object.keys(scoreGroups).map(Number).sort((a, b) => b - a);
    if (distinctScores.length === 0) return 0;

    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    let updatedUsersCount = 0;

    // Helper per aggiornare i membri di un gruppo di squadre
    const updateMembers = async (teamList, points, label) => {
        for (const team of teamList) {
            const members = team.members || [];
            for (const userId of members) {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, { punti: increment(points) });

                const requestRef = doc(collection(db, 'requests'));
                batch.set(requestRef, {
                    matricolaId: userId,
                    challengeId: 'finale_serata',
                    challengeTitle: `Classifica Serata: ${label}`,
                    puntiRichiesti: points,
                    status: 'approved',
                    manual: true,
                    approvedAt: timestamp,
                    createdAt: timestamp
                });
                updatedUsersCount++;
            }
        }
    };

    // 1° Classificato (+30)
    const firstPlaceScore = distinctScores[0];
    await updateMembers(scoreGroups[firstPlaceScore], 30, '1° Posto');

    // 2° Classificato (+15)
    if (distinctScores.length > 1) {
        const secondPlaceScore = distinctScores[1];
        await updateMembers(scoreGroups[secondPlaceScore], 15, '2° Posto');
    }

    await batch.commit();
    return updatedUsersCount;
};
export { auth, db };
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

// Aggiunge un'esibizione alla scaletta
export const addEventPerformance = async (matricolaId, matricolaName, theme) => {
  await addDoc(collection(db, 'event_performances'), {
    matricolaId,
    matricolaName,
    theme,
    status: 'pending',
    totalScore: 0,
    pointsAssigned: false,
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
    pointsAssigned: false
  });
};

// Inizia un'esibizione dalla scaletta
export const startEventPerformance = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);

  if (!perfSnap.exists()) return;
  const data = perfSnap.data();

  const batch = writeBatch(db);

  // 1. Reset di eventuali altre esibizioni 'active' (per sicurezza)
  const qActive = query(collection(db, 'event_performances'), where('status', '==', 'active'));
  const activeSnap = await getDocs(qActive);
  activeSnap.forEach(d => {
    batch.update(d.ref, { status: 'completed' });
  });

  // 2. Imposta questa come active
  batch.update(perfRef, { status: 'active' });

  // 3. Sincronizza il documento semaforo per i popup
  const liveRef = doc(db, 'live_voting', 'current');
  batch.set(liveRef, {
    isActive: true,
    votingOpen: false,
    performanceId: performanceId, // Salviamo l'ID dell'esibizione nel semaforo
    matricolaId: data.matricolaId,
    matricolaName: data.matricolaName,
    theme: data.theme,
    votes: {}
  });

  await batch.commit();
};

export const openLiveVoting = async () => {
  const liveRef = doc(db, 'live_voting', 'current');
  await updateDoc(liveRef, { votingOpen: true });
};

export const submitLiveVote = async (userId, voteValue) => {
  const liveRef = doc(db, 'live_voting', 'current');
  await updateDoc(liveRef, {
    [`votes.${userId}`]: voteValue
  });
};

// Chiude il televoto e calcola la SOMMA
export const completeEventPerformance = async (performanceId) => {
  const liveRef = doc(db, 'live_voting', 'current');
  const liveSnap = await getDoc(liveRef);

  if (!liveSnap.exists()) return;
  const liveData = liveSnap.data();

  // Calcolo SOMMA dei voti
  const votes = liveData.votes || {};
  const totalSum = Object.values(votes).reduce((acc, val) => acc + Number(val), 0);

  const batch = writeBatch(db);

  // 1. Aggiorna l'esibizione in scaletta
  const perfRef = doc(db, 'event_performances', performanceId);
  batch.update(perfRef, {
    status: 'completed',
    totalScore: totalSum
  });

  // 2. Nasconde il popup resettando il semaforo
  batch.set(liveRef, {
    isActive: false,
    votingOpen: false,
    matricolaId: '',
    matricolaName: '',
    theme: '',
    votes: {}
  });

  await batch.commit();
};

// Distribuzione finale dei punti alle squadre
export const assignAllPerformancePoints = async () => {
  // 1. Recupera tutte le esibizioni completate e non ancora assegnate
  const q = query(
    collection(db, 'event_performances'),
    where('status', '==', 'completed'),
    where('pointsAssigned', '==', false)
  );
  const perfSnap = await getDocs(q);

  if (perfSnap.empty) throw new Error("Nessun punto da assegnare o già assegnati.");

  const batch = writeBatch(db);

  // 2. Recupera le squadre dell'evento per sapere chi sta con chi
  const teamsSnap = await getDocs(collection(db, 'event_teams'));
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let assignmentsCount = 0;

  perfSnap.forEach(pDoc => {
    const perf = pDoc.data();

    // Trova la squadra che contiene questa matricola
    const targetTeam = teams.find(t => (t.members || []).includes(perf.matricolaId));

    if (targetTeam && perf.totalScore > 0) {
      const teamRef = doc(db, 'event_teams', targetTeam.id);
      batch.update(teamRef, { score: increment(perf.totalScore) });
      assignmentsCount++;
    }

    // Segna l'esibizione come "punti assegnati"
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
  // finalResults di solito contiene [{ teamId, rawScore, earnedPoints, rank }, ...]
  const results = challengeData.finalResults;
  
  // Trova il rank minimo (es. 1 = primo) e il rank massimo (es. 3 = ultimo)
  const minRank = Math.min(...results.map(r => r.rank));
  const maxRank = Math.max(...results.map(r => r.rank));

  const winningTeamIds = results.filter(r => r.rank === minRank).map(r => r.teamId);
  const losingTeamIds = results.filter(r => r.rank === maxRank).map(r => r.teamId);

  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  
  // Helper per recuperare i membri di una squadra della serata
  const getTeamMembers = async (teamId) => {
      const tSnap = await getDoc(doc(db, 'event_teams', teamId));
      return tSnap.exists() ? (tSnap.data().members || []) : [];
  };

  // Helper per preparare la transazione per una matricola
  const prepareMatricolaUpdate = async (userId, points, isWinner) => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const currentPoints = userSnap.data().punti || 0;
      batch.update(userRef, { punti: currentPoints + points });

      // Crea un record nello storico (requests) per trasparenza
      const requestRef = doc(collection(db, 'requests'));
      const statusText = isWinner ? '1° Posto' : 'Ultimo Posto';
      batch.set(requestRef, {
        matricolaId: userId,
        challengeId: challengeId, // Usiamo l'ID della sfida come riferimento
        challengeTitle: `Evento - ${challengeData.title}: ${statusText}`,
        puntiRichiesti: points,
        status: 'approved',
        manual: true,
        approvedAt: timestamp,
        createdAt: timestamp
      });
  };

  // 2. Elabora i vincitori (+5)
  for (const teamId of winningTeamIds) {
      const members = await getTeamMembers(teamId);
      for (const userId of members) {
          await prepareMatricolaUpdate(userId, 5, true);
      }
  }

  // 3. Elabora i perdenti (-5)
  // Assicuriamoci che vincitori e perdenti non siano gli stessi (es. se c'è un pareggio totale)
  if (minRank !== maxRank) {
      for (const teamId of losingTeamIds) {
          const members = await getTeamMembers(teamId);
          for (const userId of members) {
              await prepareMatricolaUpdate(userId, -5, false);
          }
      }
  }

  // 4. Segna la sfida come propagata per evitare doppi click
  batch.update(challengeRef, { fantaPropagated: true });

  await batch.commit();
};

// Annulla la propagazione
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
      // L'operatore matematico inverso: se era 5 fa -5, se era -5 fa +5
      batch.update(userRef, { punti: increment(-data.puntiRichiesti) });
      batch.delete(reqDoc.ref);
    }
  }

  // 2. Resetta il flag
  batch.update(challengeRef, { fantaPropagated: false });

  await batch.commit();
};


export { auth, db };
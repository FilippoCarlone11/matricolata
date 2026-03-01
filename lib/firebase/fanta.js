import { db } from './init';
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  query, where, getDocs, onSnapshot, serverTimestamp, orderBy, runTransaction, limit, writeBatch, arrayRemove, arrayUnion, increment
} from 'firebase/firestore';

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
    transaction.update(userRef, { punti: Math.max(0, (userDoc.data().punti || 0) - points) });
  });
};

// Assegnazione Manuale (Senza sfida esistente)
export const manualAddPoints = async (userId, points, reason) => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw "Utente non trovato";

    transaction.update(userRef, { punti: Math.max(0, (userDoc.data().punti || 0) + points) });

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

    transaction.update(userRef, { punti: Math.max(0, (userDoc.data().punti || 0) + points) });

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



import { 
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  query, where, getDocs, onSnapshot, serverTimestamp, orderBy, runTransaction, limit 
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
export const updateUserProfile = async (userId, newName, newTeamName, newPhotoURL) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    displayName: newName,
    teamName: newTeamName || '',
    photoURL: newPhotoURL
  });
};

// Eliminazione Utente
export const deleteUserDocument = async (userId) => {
  await deleteDoc(doc(db, 'users', userId));
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
          } catch (e) {}
      }

      // Recupero Dati Sfida
      let challengeName = data.challengeName || data.challengeTitle || 'Sfida';
      let challengeIcon = '❓'; 

      if (data.challengeId) {
          try {
            const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
            if(cSnap.exists()) {
                const cData = cSnap.data();
                challengeName = cData.titolo;
                challengeIcon = cData.icon || '🏆';
            }
          } catch(e) {}
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
       } catch(e) {}
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
         } catch(e) {}
      }

      // 2. Recupera Info Sfida (Nome + SE È NASCOSTA)
      let challengeName = data.challengeName || data.challengeTitle || data.challengeId;
      let isHidden = false; // Flag per sfide segrete

      // Se c'è un ID sfida, andiamo a leggere il doc originale per sapere se è hidden
      if (data.challengeId && data.challengeId.length > 15) {
        try {
          const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
          if(cSnap.exists()) {
              const cData = cSnap.data();
              if (!data.challengeTitle && !data.manual) challengeName = cData.titolo;
              isHidden = cData.hidden || false; // <--- ECCO LA MODIFICA RICHIESTA
          }
        } catch(e) {}
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
  const docRef = doc(db, 'config', 'appSettings');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    // Se non esiste, crealo aperto di default
    await setDoc(docRef, { registrationsOpen: true });
    return { registrationsOpen: true };
  }
};

export const toggleRegistrations = async (isOpen) => {
  const docRef = doc(db, 'config', 'appSettings');
  // Usa setDoc con merge per non sovrascrivere altri settings futuri
  await setDoc(docRef, { registrationsOpen: isOpen }, { merge: true });
};
export { auth, db };
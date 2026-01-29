import { 
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  query, where, getDocs, onSnapshot, serverTimestamp, orderBy, runTransaction 
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

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

// --- AUTH & USER ---
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
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

export const signOutUser = async () => await signOut(auth);

export const getUserData = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
};

export const getAllUsers = async () => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateUserRole = async (uid, newRole) => {
  await updateDoc(doc(db, 'users', uid), { role: newRole });
};

export const onUsersChange = (callback) => {
  const usersRef = collection(db, 'users');
  return onSnapshot(usersRef, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  });
};

// --- GESTIONE SFIDE ---

export const createChallenge = async (challengeData) => {
  await addDoc(collection(db, 'challenges'), {
    ...challengeData,
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

// --- GESTIONE RICHIESTE (Matricola -> Admin) ---

export const createRequest = async (matricolaId, challengeId, points) => {
  await addDoc(collection(db, 'requests'), {
    matricolaId, challengeId, puntiRichiesti: points,
    status: 'pending', createdAt: serverTimestamp()
  });
};

export const getUserRequests = async (userId) => {
  const q = query(collection(db, 'requests'), where('matricolaId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Listener Realtime per le richieste pendenti (Senza orderBy per evitare problemi di indici)
export const onPendingRequestsChange = (callback) => {
  const q = query(
    collection(db, 'requests'),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, async (snapshot) => {
    const requestsProm = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      
      let userData = { displayName: 'Sconosciuto', photoURL: null };
      try {
        const userSnap = await getDoc(doc(db, 'users', data.matricolaId));
        if (userSnap.exists()) userData = userSnap.data();
      } catch (e) {}

      let challengeName = data.challengeId;
      if (data.challengeId && data.challengeId.length > 15) {
          try {
            const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
            if(cSnap.exists()) challengeName = cSnap.data().titolo;
          } catch(e) {}
      }

      return {
        id: docSnap.id,
        ...data,
        userName: userData.displayName,
        userPhoto: userData.photoURL,
        challengeName: challengeName
      };
    });

    const results = await Promise.all(requestsProm);
    
    // Ordiniamo qui via Javascript (dal più recente)
    const sortedResults = results.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
        return dateB - dateA;
    });

    callback(sortedResults);
  });
};

// Approva richiesta e dai punti
export const approveRequest = async (requestId, matricolaId, points) => {
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

export const rejectRequest = async (requestId) => {
  await updateDoc(doc(db, 'requests', requestId), { status: 'rejected', rejectedAt: serverTimestamp() });
};

// --- GESTIONE STORICO E REVOCA ---

// 1. Ottieni tutte le richieste APPROVATE di un utente specifico
export const getApprovedRequestsByUser = async (userId) => {
  const q = query(
    collection(db, 'requests'),
    where('matricolaId', '==', userId),
    where('status', '==', 'approved')
  );
  
  const snapshot = await getDocs(q);
  
  const requests = await Promise.all(snapshot.docs.map(async (docSnap) => {
    const data = docSnap.data();
    let challengeName = data.challengeId;
    
    if (!data.manual && data.challengeId && data.challengeId.length > 15) {
       try {
         const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
         if (cSnap.exists()) challengeName = cSnap.data().titolo;
       } catch(e) {}
    }

    return {
      id: docSnap.id,
      ...data,
      challengeName
    };
  }));
  
  return requests.sort((a, b) => {
    const dateA = a.approvedAt?.toDate ? a.approvedAt.toDate() : new Date(0);
    const dateB = b.approvedAt?.toDate ? b.approvedAt.toDate() : new Date(0);
    return dateB - dateA;
  });
};

// 2. REVOCA una sfida approvata
export const revokeApprovedRequest = async (requestId, userId, points) => {
  try {
    await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, 'requests', requestId);
      const userRef = doc(db, 'users', userId);

      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw "Utente non trovato";

      const currentPoints = userDoc.data().punti || 0;

      transaction.update(requestRef, { status: 'revoked', revokedAt: serverTimestamp() });
      transaction.update(userRef, { punti: currentPoints - points });
    });
  } catch (e) {
    console.error("Errore revoca:", e);
    throw e;
  }
};

// 3. Aggiungi punti MANUALMENTE (Admin -> Matricola)
export const manualAddPoints = async (userId, points, reason) => {
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists()) throw "Utente non trovato";

      const currentPoints = userDoc.data().punti || 0;
      
      transaction.update(userRef, { punti: currentPoints + points });

      const requestRef = doc(collection(db, 'requests'));
      transaction.set(requestRef, {
        matricolaId: userId,
        challengeId: reason || 'Bonus Manuale',
        puntiRichiesti: points,
        status: 'approved',
        manual: true,
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    });
  } catch (e) {
    console.error("Errore assegnazione manuale:", e);
    throw e;
  }
};

// --- GESTIONE SQUADRA E MERCATO (MODIFICATA PER MULTIPLI POSSESSORI) ---

export const getMarketStatus = async () => {
  const docRef = doc(db, 'settings', 'config');
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().marketOpen : true; 
};

export const toggleMarketStatus = async (isOpen) => {
  await setDoc(doc(db, 'settings', 'config'), { marketOpen: isOpen }, { merge: true });
};

// MODIFICATO: Restituisce TUTTE le matricole, senza filtrare quelle già prese
export const getAvailableMatricole = async () => {
  const q = query(collection(db, 'users'), where('role', '==', 'matricola'));
  const snapshot = await getDocs(q);
  // Rimuoviamo il filtro .filter(m => !m.squadraId)
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

// MODIFICATO: Rimosso il controllo e la scrittura dell'esclusività (squadraId sulla matricola)
export const recruitMatricola = async (captainId, matricolaId) => {
  await runTransaction(db, async (transaction) => {
    const captainRef = doc(db, 'users', captainId);
    // Non serve più scrivere sulla matricola, ma controlliamo che esista
    const matricolaRef = doc(db, 'users', matricolaId); 
    
    const captainDoc = await transaction.get(captainRef);
    const matricolaDoc = await transaction.get(matricolaRef); 

    if (!matricolaDoc.exists()) throw "Matricola non trovata";

    const captainData = captainDoc.data();
    const currentSquad = captainData.mySquad || [];

    if (currentSquad.length >= 3) throw "Hai già 3 matricole!";
    // Controllo per non comprare due volte la stessa persona
    if (currentSquad.includes(matricolaId)) throw "Hai già questa matricola in rosa!";

    // Aggiorniamo SOLO il capitano (l'utente che compra)
    transaction.update(captainRef, { mySquad: [...currentSquad, matricolaId] });
    
    // RIMOSSO: transaction.update(matricolaRef, ...); La matricola non appartiene a nessuno in esclusiva
  });
};

// MODIFICATO: Rimuove solo dalla rosa del capitano
export const releaseMatricola = async (captainId, matricolaId) => {
  await runTransaction(db, async (transaction) => {
    const captainRef = doc(db, 'users', captainId);
    const captainDoc = await transaction.get(captainRef);

    const captainData = captainDoc.data();
    const newSquad = (captainData.mySquad || []).filter(id => id !== matricolaId);
    
    let newCaptainId = captainData.captainId;
    if (captainData.captainId === matricolaId) newCaptainId = null;

    transaction.update(captainRef, { mySquad: newSquad, captainId: newCaptainId });
    // RIMOSSO: aggiornamento matricolaRef
  });
};

export const setSquadCaptain = async (userId, matricolaId) => {
  await updateDoc(doc(db, 'users', userId), { captainId: matricolaId });
};

// --- LEADERBOARDS (CON CAPITANO X2) ---
export const getLeaderboards = async () => {
  const snapshot = await getDocs(collection(db, 'users'));
  const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const matricole = allUsers.filter(u => u.role === 'matricola').sort((a, b) => (b.punti || 0) - (a.punti || 0));
  
  const fantallenatori = allUsers
    .filter(u => u.role !== 'matricola')
    .map(allenatore => {
      let fantaPuntiTotali = 0;
      
      if (allenatore.mySquad && allenatore.mySquad.length > 0) {
        allenatore.mySquad.forEach(matricolaId => {
          const matricolaReale = allUsers.find(u => u.id === matricolaId);
          
          if (matricolaReale) {
            const puntiBase = matricolaReale.punti || 0;
            const isCaptain = allenatore.captainId === matricolaId;
            const moltiplicatore = isCaptain ? 2 : 1;
            fantaPuntiTotali += (puntiBase * moltiplicatore);
          }
        });
      }
      return { ...allenatore, fantaPunti: fantaPuntiTotali };
    })
    .sort((a, b) => b.fantaPunti - a.fantaPunti);

  return { matricole, fantallenatori };
};

export const updateUserProfile = async (userId, newName, newTeamName, newPhotoURL) => {
  try {
    const userRef = doc(db, 'users', userId);
    // Aggiorniamo nome, foto e anche il nome della squadra
    await updateDoc(userRef, {
      displayName: newName,
      teamName: newTeamName || '', // Se vuoto, salva stringa vuota
      photoURL: newPhotoURL
    });
  } catch (e) {
    console.error("Errore aggiornamento profilo:", e);
    throw e;
  }
};
export { auth, db };
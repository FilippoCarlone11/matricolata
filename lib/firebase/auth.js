import { auth, db, googleProvider } from './init';
import { getSystemSettings } from './fanta'; // <-- IMPORTANTE: Collega auth.js a fanta.js
import {
  collection, doc, getDoc, setDoc, updateDoc,
  query, where, getDocs, onSnapshot, serverTimestamp, writeBatch, arrayRemove
} from 'firebase/firestore';
import {
  signInWithPopup, signOut, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, updateProfile
} from 'firebase/auth'; // <-- IMPORTANTE: Funzioni di Auth



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
      puntiSerata: 0, // <-- Corretto! Pronto per il raddoppio
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
    puntiSerata: 0, // <-- Corretto!
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

    // 3. RIMUOVI UTENTE DALLE SQUADRE DELLA SERATA LIVE (Fix per la V2!)
    const eventTeamsRef = collection(db, 'event_teams');
    const qEventTeams = query(eventTeamsRef, where('members', 'array-contains', userId));
    const eventTeamsSnap = await getDocs(qEventTeams);

    eventTeamsSnap.forEach((doc) => {
      batch.update(doc.ref, { members: arrayRemove(userId) });
    });

    // 4. ELIMINA IL DOCUMENTO UTENTE
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
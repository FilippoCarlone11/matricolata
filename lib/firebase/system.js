import { db } from './init';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
        matricolaBlur: false 
      };
      await setDoc(docRef, defaults);
      return defaults;
    }
  } catch (error) {
    console.error("Errore lettura settings:", error);
    return { registrationsOpen: true, cacheEnabled: true, cacheDuration: 30, matricolaBlur: false };
  }
};

export const toggleMatricolaBlur = async (isBlur) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, { matricolaBlur: isBlur }, { merge: true });
};

export const toggleRegistrations = async (isOpen) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, { registrationsOpen: isOpen }, { merge: true });
};

export const updateCacheSettings = async (isEnabled, duration) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, {
    cacheEnabled: isEnabled,
    cacheDuration: parseInt(duration) || 30
  }, { merge: true });
};

export const updateSystemSettings = async (newSettings) => {
  const docRef = doc(db, 'config', 'appSettings');
  await setDoc(docRef, newSettings, { merge: true });
};
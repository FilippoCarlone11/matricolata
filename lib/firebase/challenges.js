import { db } from './init';
import { collection, doc, getDocs, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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
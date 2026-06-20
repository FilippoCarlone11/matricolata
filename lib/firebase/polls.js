import { db } from './init';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';

// =====================================================================
//  SONDAGGI (Polls)
//  - Creazione riservata alle non-matricole (Anziani/Admin)
//  - Voto aperto a tutti gli utenti loggati (1 voto a testa, modificabile)
//  Le autorizzazioni sono imposte lato server dalle Firestore Rules:
//  qui validiamo solo per dare feedback immediato all'utente.
// =====================================================================

const MAX_OPTIONS = 6;

export const createPoll = async (question, options, author) => {
  const q = (question || '').trim();
  const clean = (options || []).map((o) => (o || '').trim()).filter(Boolean).slice(0, MAX_OPTIONS);

  if (!q) throw new Error('La domanda è obbligatoria.');
  if (clean.length < 2) throw new Error('Servono almeno 2 opzioni.');

  await addDoc(collection(db, 'polls'), {
    question: q,
    options: clean,
    authorId: author?.uid || author?.id,
    authorName: author?.displayName || 'Anonimo',
    authorPhoto: author?.photoURL || null,
    votes: {}, // mappa uid -> indice opzione
    createdAt: serverTimestamp(),
  });
};

export const onPollsChange = (callback) => {
  const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const votePoll = async (pollId, userId, optionIndex) => {
  if (!userId) throw new Error('Utente non valido.');
  const idx = Number(optionIndex);
  if (!Number.isInteger(idx) || idx < 0) throw new Error('Opzione non valida.');
  await updateDoc(doc(db, 'polls', pollId), {
    [`votes.${userId}`]: idx,
  });
};

export const setPollClosed = async (pollId, closed) => {
  await updateDoc(doc(db, 'polls', pollId), { closed: !!closed });
};

export const deletePoll = async (pollId) => {
  await deleteDoc(doc(db, 'polls', pollId));
};

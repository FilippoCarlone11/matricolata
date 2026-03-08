import { db } from './init';
import { collection, doc, getDoc, updateDoc, addDoc, deleteDoc, getDocs, serverTimestamp, writeBatch, arrayRemove, arrayUnion, increment } from 'firebase/firestore';


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
  const teamSnap = await getDoc(teamRef);
  
  if (!teamSnap.exists()) return;
  const teamName = teamSnap.data().name;

  const batch = writeBatch(db);

  // 1. Aggiunge alla squadra della regia
  batch.update(teamRef, {
    members: arrayUnion(userId)
  });

  // 2. Scrive il nome della squadra direttamente sul profilo della matricola
  const userRef = doc(db, 'users', userId);
  batch.update(userRef, {
    teamName: teamName
  });

  await batch.commit();
};

// 4. Rimuovi una matricola dalla squadra della serata (E PULISCE IL TEAMNAME!)
export const removeMatricolaFromEventTeam = async (teamId, userId) => {
  const batch = writeBatch(db);

  // 1. Rimuove dalla squadra della regia
  const teamRef = doc(db, 'event_teams', teamId);
  batch.update(teamRef, {
    members: arrayRemove(userId)
  });

  // 2. Pulisce il nome della squadra dal profilo
  const userRef = doc(db, 'users', userId);
  batch.update(userRef, {
    teamName: null
  });

  await batch.commit();
};

// Aggiorna il nome di una squadra della serata
export const updateEventTeamName = async (teamId, newName) => {
  const teamRef = doc(db, 'event_teams', teamId);
  await updateDoc(teamRef, { name: newName });
};

// Aggiungi punti manuali al tabellone squadre
export const addManualPointsToEventTeams = async (teamPoints) => {
  const batch = writeBatch(db);

  for (const [teamId, points] of Object.entries(teamPoints)) {
    const numPoints = Number(points);
    if (numPoints !== 0) {
      const teamRef = doc(db, 'event_teams', teamId);
      if (numPoints < 0) {
         const teamSnap = await getDoc(teamRef);
         if(teamSnap.exists()){
             const currentScore = teamSnap.data().score || 0;
             batch.update(teamRef, { score: currentScore + numPoints });
         }
      } else {
         batch.update(teamRef, { score: increment(numPoints) });
      }
    }
  }

  await batch.commit();
};

// 📋 FETCH SQUADRE
export const getEventTeams = async () => {
  const snap = await getDocs(collection(db, 'event_teams'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
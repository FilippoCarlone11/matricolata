import { db } from './init';
import { collection, doc, getDoc, updateDoc, addDoc, deleteDoc, query, where, getDocs, serverTimestamp, writeBatch, increment } from 'firebase/firestore';


// Aggiunge un'esibizione alla scaletta 
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

// Inizia un'esibizione dalla scaletta
export const startEventPerformance = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);

  if (!perfSnap.exists()) return;
  const data = perfSnap.data();

  const batch = writeBatch(db);

  const qActive = query(collection(db, 'event_performances'), where('status', '==', 'active'));
  const activeSnap = await getDocs(qActive);
  activeSnap.forEach(d => {
    batch.update(d.ref, { status: 'pending' }); 
  });

  batch.update(perfRef, { status: 'active' });

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

// 🔴 ANNULLA un'esibizione LIVE
export const cancelLivePerformance = async () => {
  const liveRef = doc(db, 'live_voting', 'current');
  const liveSnap = await getDoc(liveRef);
  if (!liveSnap.exists()) return;

  const { performanceId } = liveSnap.data();
  const batch = writeBatch(db);

  if (performanceId) {
    const perfRef = doc(db, 'event_performances', performanceId);
    batch.update(perfRef, {
      status: 'pending',
      totalScore: 0,
      votersCount: 0
    });
  }

  batch.delete(liveRef);
  await batch.commit();
};

// ✅ CHIUDE e SALVA un'esibizione live
export const completeEventPerformance = async (performanceId) => {
  const liveRef = doc(db, 'live_voting', 'current');
  const liveSnap = await getDoc(liveRef);
  if (!liveSnap.exists()) return;

  const data = liveSnap.data();
  const votes = Object.values(data.votes || {});
  const totalSum = votes.reduce((a, b) => a + Number(b), 0); 

  const batch = writeBatch(db);
  const perfRef = doc(db, 'event_performances', performanceId);

  batch.update(perfRef, {
    status: 'completed',
    totalScore: totalSum,
    votersCount: votes.length
  });

  batch.delete(liveRef); 
  await batch.commit();
};


// ==========================================
// 🌟 PROPAGA SOMMA AL FANTA (SICURO E FIXATO PER SERATA)
// ==========================================
export const propagateSinglePerformanceToFanta = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);
  if (!perfSnap.exists()) throw new Error("Esibizione non trovata.");

  const perfData = perfSnap.data();
  if (perfData.fantaPropagated) throw new Error("Punti già propagati al Fanta per questa esibizione!");
  if (perfData.totalScore === 0) throw new Error("Il punteggio è 0, nulla da propagare.");

  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  const puntiDaPropagare = Number(perfData.totalScore) || 0;

  if (perfData.isTeam) {
    if (!perfData.teamId) throw new Error("teamId mancante su questa esibizione di squadra.");

    const teamSnap = await getDoc(doc(db, 'event_teams', perfData.teamId));
    if (!teamSnap.exists()) throw new Error("Squadra non trovata.");

    const members = teamSnap.data().members || [];
    if (members.length === 0) throw new Error("La squadra non ha membri.");

    for (const memberId of members) {
      const userRef = doc(db, 'users', memberId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentPoints = Number(userSnap.data().punti) || 0;
        const currentEveningPoints = Number(userSnap.data().puntiSerata) || 0;
        
        batch.update(userRef, { 
          punti: currentPoints + puntiDaPropagare,
          puntiSerata: currentEveningPoints + puntiDaPropagare
        });
      }

      const requestRef = doc(collection(db, 'requests'));
      batch.set(requestRef, {
        matricolaId: memberId,
        challengeId: `televoto_${performanceId}`, 
        challengeTitle: `Televoto (Squadra): ${perfData.theme}`,
        puntiRichiesti: puntiDaPropagare,
        teamId: perfData.teamId,
        status: 'approved',
        manual: true,
        isEveningEvent: true, // ✅ FIX 
        approvedAt: timestamp,
        createdAt: timestamp,
      });
    }

  } else {
    if (!perfData.matricolaId) throw new Error("Nessuna matricola associata.");

    const userRef = doc(db, 'users', perfData.matricolaId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const currentPoints = Number(userSnap.data().punti) || 0;
      const currentEveningPoints = Number(userSnap.data().puntiSerata) || 0;
      
      batch.update(userRef, { 
        punti: currentPoints + puntiDaPropagare,
        puntiSerata: currentEveningPoints + puntiDaPropagare
      });
    }

    const requestRef = doc(collection(db, 'requests'));
    batch.set(requestRef, {
      matricolaId: perfData.matricolaId,
      challengeId: `televoto_${performanceId}`,
      challengeTitle: `Televoto: ${perfData.theme}`,
      puntiRichiesti: puntiDaPropagare,
      status: 'approved',
      manual: true,
      isEveningEvent: true, // ✅ FIX
      approvedAt: timestamp,
      createdAt: timestamp,
    });
  }

  batch.update(perfRef, { fantaPropagated: true });
  await batch.commit();
};

// ==========================================
// ↩️ ROLLBACK FANTA (SICURO ANTI-NEGATIVO)
// ==========================================
export const rollbackFantaPropagation = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);
  if (!perfSnap.exists()) throw new Error("Esibizione non trovata.");

  const perfData = perfSnap.data();
  if (!perfData.fantaPropagated) throw new Error("Non ancora propagata.");
  
  const batch = writeBatch(db);

  const qReq = query(collection(db, 'requests'), where('challengeId', '==', `televoto_${performanceId}`));
  const reqSnap = await getDocs(qReq);

  for (const rDoc of reqSnap.docs) {
    const rData = rDoc.data();
    if (rData.matricolaId && rData.puntiRichiesti) {
      const userRef = doc(db, 'users', rData.matricolaId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
         const currentPts = Number(userSnap.data().punti) || 0;
         const currentEveningPts = Number(userSnap.data().puntiSerata) || 0; 
         const puntiDaTogliere = Number(rData.puntiRichiesti) || 0;

         batch.update(userRef, { 
             punti: currentPts - puntiDaTogliere,
             puntiSerata: currentEveningPts - puntiDaTogliere 
         });
      }
      batch.delete(rDoc.ref);
    }
  }

  batch.update(perfRef, { fantaPropagated: false });
  await batch.commit();
};


// ==========================================
// 🔁 RIPETI ESIBIZIONE E AZZERA
// ==========================================
export const repeatPerformanceTelvoto = async (performanceId) => {
  const perfRef = doc(db, 'event_performances', performanceId);
  const perfSnap = await getDoc(perfRef);
  if (!perfSnap.exists()) throw new Error("Esibizione non trovata.");

  const perfData = perfSnap.data();

  if (perfData.fantaPropagated && perfData.totalScore > 0) {
      await rollbackFantaPropagation(performanceId);
  }

  if (perfData.pointsAssigned) {
      throw new Error("I punti sono già stati assegnati al tabellone squadre. Usa il tasto Azzera Punteggi Squadre prima di ripetere questa esibizione.");
  }

  await updateDoc(perfRef, {
    status: 'pending',
    totalScore: 0,
    votersCount: 0,
    fantaPropagated: false,
    pointsAssigned: false,
  });
};


// ==========================================
// 💣 RESET TOTALE TELEVOTO (PULITO E SICURO)
// ==========================================
export const fullResetTelvoto = async () => {
  const perfSnap = await getDocs(collection(db, 'event_performances'));
  let resetCount = 0;

  for (const pDoc of perfSnap.docs) {
      const perf = pDoc.data();
      
      if (perf.fantaPropagated) {
          await rollbackFantaPropagation(pDoc.id);
      }

      await updateDoc(pDoc.ref, {
        status: 'pending',
        totalScore: 0,
        votersCount: 0,
        fantaPropagated: false,
        pointsAssigned: false,
      });
      resetCount++;
  }

  const teamsSnap = await getDocs(collection(db, 'event_teams'));
  const batch = writeBatch(db);
  teamsSnap.forEach(tDoc => {
      batch.update(tDoc.ref, { score: 0 });
  });

  const liveRef = doc(db, 'live_voting', 'current');
  const liveSnap = await getDoc(liveRef);
  if (liveSnap.exists()) batch.delete(liveRef);

  await batch.commit();
  return resetCount;
};


// 🏆 ASSEGNAZIONE FINALE PUNTI ALLE SQUADRE
export const assignAllPerformancePoints = async () => {
  const q = query(
    collection(db, 'event_performances'),
    where('status', '==', 'completed'),
    where('pointsAssigned', '==', false)
  );
  const perfSnap = await getDocs(q);

  if (perfSnap.empty) throw new Error("Nessun punto da assegnare, o già tutti assegnati.");

  const teamsSnap = await getDocs(collection(db, 'event_teams'));
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const teamUpdates = {};
  teams.forEach(t => {
      teamUpdates[t.id] = { flatPoints: 0, indSum: 0, indCount: 0 };
  });

  perfSnap.docs.forEach(pDoc => {
    const perf = pDoc.data();

    if (perf.isTeam && perf.teamId) {
      if (teamUpdates[perf.teamId]) {
          teamUpdates[perf.teamId].flatPoints += perf.totalScore;
      }
    } else if (perf.matricolaId) {
      const targetTeam = teams.find(t => (t.members || []).includes(perf.matricolaId));
      if (targetTeam && teamUpdates[targetTeam.id]) {
          teamUpdates[targetTeam.id].indSum += perf.totalScore;
          teamUpdates[targetTeam.id].indCount += 1;
      }
    }
  });

  const batch = writeBatch(db);
  let assignmentsCount = 0;

  for (const [teamId, data] of Object.entries(teamUpdates)) {
    let finalPointsToAdd = data.flatPoints; 
    
    if (data.indCount > 0) {
        finalPointsToAdd += Math.round(data.indSum / data.indCount); 
    }

    if (finalPointsToAdd > 0) {
        const teamRef = doc(db, 'event_teams', teamId);
        batch.update(teamRef, { score: increment(finalPointsToAdd) });
        assignmentsCount++;
    }
  }

  perfSnap.docs.forEach(pDoc => {
    batch.update(pDoc.ref, { pointsAssigned: true });
  });

  await batch.commit();
  return assignmentsCount;
};

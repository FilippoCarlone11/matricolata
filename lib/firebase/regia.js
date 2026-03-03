import { db } from './init';
import {
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  query, where, getDocs, serverTimestamp, writeBatch, arrayRemove, arrayUnion, increment
} from 'firebase/firestore';

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

// --- LOGICA: RISOLUZIONE CON PAREGGI (EX AEQUO) ---
export const resolveEventChallenge = async (challengeId, teamRawScores, pointsScheme) => {
  const batch = writeBatch(db);

  const teamsArray = Object.keys(teamRawScores).map(teamId => ({
    teamId,
    rawScore: Number(teamRawScores[teamId] || 0)
  })).sort((a, b) => b.rawScore - a.rawScore);

  const scoreGroups = {};
  teamsArray.forEach(t => {
    if (!scoreGroups[t.rawScore]) scoreGroups[t.rawScore] = [];
    scoreGroups[t.rawScore].push(t);
  });

  const distinctScores = Object.keys(scoreGroups).map(Number).sort((a, b) => b - a);

  const finalResults = [];
  let currentRankIndex = 0; 

  distinctScores.forEach(score => {
    const tiedTeams = scoreGroups[score];
    const numTied = tiedTeams.length; 

    let totalPointsForGroup = 0;
    for (let i = 0; i < numTied; i++) {
      totalPointsForGroup += (pointsScheme[currentRankIndex + i] || 0);
    }

    const averagePoints = Math.round(totalPointsForGroup / numTied);

    tiedTeams.forEach(team => {
      finalResults.push({
        teamId: team.teamId,
        rawScore: score,
        earnedPoints: averagePoints,
        rank: currentRankIndex + 1 
      });

      if (averagePoints > 0) {
        const teamRef = doc(db, 'event_teams', team.teamId);
        batch.update(teamRef, { score: increment(averagePoints) });
      }
    });

    currentRankIndex += numTied;
  });

  const challengeRef = doc(db, 'event_challenges', challengeId);
  batch.update(challengeRef, {
    status: 'completed',
    finalResults: finalResults
  });

  await batch.commit();
};

// --- FUNZIONE: RIAPRI UNA SFIDA E SOTTRAI I PUNTI (SICURO) ---
export const revertEventChallenge = async (challengeId) => {
  const challengeRef = doc(db, 'event_challenges', challengeId);
  const challengeSnap = await getDoc(challengeRef);

  if (!challengeSnap.exists()) return;
  const challengeData = challengeSnap.data();

  if (challengeData.status !== 'completed' || !challengeData.finalResults) return;

  const batch = writeBatch(db);

  for (const res of challengeData.finalResults) {
      if (res.earnedPoints > 0 && res.teamId) {
          const teamRef = doc(db, 'event_teams', res.teamId);
          const teamSnap = await getDoc(teamRef);
          if(teamSnap.exists()){
              const currentScore = teamSnap.data().score || 0;
              const newScore =  currentScore - res.earnedPoints;
              batch.update(teamRef, { score: newScore });
          }
      }
  }

  batch.update(challengeRef, {
    status: 'active',
    finalResults: null
  });

  await batch.commit();
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

// 📋 FETCH SQUADRE
export const getEventTeams = async () => {
  const snap = await getDocs(collection(db, 'event_teams'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

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

  if (perfData.isTeam) {
    if (!perfData.teamId) throw new Error("teamId mancante su questa esibizione di squadra.");

    const teamSnap = await getDoc(doc(db, 'event_teams', perfData.teamId));
    if (!teamSnap.exists()) throw new Error("Squadra non trovata.");

    const members = teamSnap.data().members || [];
    if (members.length === 0) throw new Error("La squadra non ha membri.");

    for (const memberId of members) {
      const userRef = doc(db, 'users', memberId);
      batch.update(userRef, { 
       punti: increment(perfData.totalScore),
       puntiSerata: increment(perfData.totalScore)
      });

      const requestRef = doc(collection(db, 'requests'));
      batch.set(requestRef, {
        matricolaId: memberId,
        challengeId: `televoto_${performanceId}`, 
        challengeTitle: `Televoto (Squadra): ${perfData.theme}`,
        puntiRichiesti: perfData.totalScore,
        teamId: perfData.teamId,
        status: 'approved',
        manual: true,
        approvedAt: timestamp,
        createdAt: timestamp,
      });
    }

  } else {
    if (!perfData.matricolaId) throw new Error("Nessuna matricola associata.");

    const userRef = doc(db, 'users', perfData.matricolaId);
    batch.update(userRef, { 
      punti: increment(perfData.totalScore),
      puntiSerata: increment(perfData.totalScore)
    });

    const requestRef = doc(collection(db, 'requests'));
    batch.set(requestRef, {
      matricolaId: perfData.matricolaId,
      challengeId: `televoto_${performanceId}`,
      challengeTitle: `Televoto: ${perfData.theme}`,
      puntiRichiesti: perfData.totalScore,
      status: 'approved',
      manual: true,
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
         const currentPts = userSnap.data().punti || 0;
         const currentEveningPts = userSnap.data().puntiSerata || 0; 

         const newPts = currentPts - rData.puntiRichiesti; 
         const newEveningPts = currentEveningPts - rData.puntiRichiesti;
         
         batch.update(userRef, { 
             punti: newPts,
             puntiSerata: newEveningPts 
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

// ==========================================
// 🔗 PROPAGAZIONE AL FANTAMATRICOLA (DA SFIDE/MINIGIOCHI)
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

  const results = challengeData.finalResults;
  const minRank = Math.min(...results.map(r => r.rank));
  const maxRank = Math.max(...results.map(r => r.rank));

  const winningTeamIds = results.filter(r => r.rank === minRank).map(r => r.teamId);
  const losingTeamIds = results.filter(r => r.rank === maxRank).map(r => r.teamId);

  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  
  const getTeamMembers = async (teamId) => {
      const tSnap = await getDoc(doc(db, 'event_teams', teamId));
      return tSnap.exists() ? (tSnap.data().members || []) : [];
  };

  const prepareMatricolaUpdate = async (userId, points, isWinner) => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const currentPoints = userSnap.data().punti || 0;
      const currentEveningPoints = userSnap.data().puntiSerata || 0; 
      
      batch.update(userRef, { 
          punti: currentPoints + points,
          puntiSerata: currentEveningPoints + points
      });

      const requestRef = doc(collection(db, 'requests'));
      const statusText = isWinner ? '1° Posto' : 'Ultimo Posto';
      batch.set(requestRef, {
        matricolaId: userId,
        challengeId: challengeId,
        challengeTitle: `Evento - ${challengeData.title}: ${statusText}`,
        puntiRichiesti: points,
        status: 'approved',
        manual: true,
        approvedAt: timestamp,
        createdAt: timestamp
      });
  };

  for (const teamId of winningTeamIds) {
      const members = await getTeamMembers(teamId);
      for (const userId of members) {
          await prepareMatricolaUpdate(userId, 5, true);
      }
  }

  if (minRank !== maxRank) {
      for (const teamId of losingTeamIds) {
          const members = await getTeamMembers(teamId);
          for (const userId of members) {
              await prepareMatricolaUpdate(userId, -5, false);
          }
      }
  }

  batch.update(challengeRef, { fantaPropagated: true });
  await batch.commit();
};

export const revertFantaPropagation = async (challengeId) => {
  const challengeRef = doc(db, 'event_challenges', challengeId);
  const qRequests = query(collection(db, 'requests'), where('challengeId', '==', challengeId));
  const reqSnap = await getDocs(qRequests);

  const batch = writeBatch(db);

  for (const reqDoc of reqSnap.docs) {
    const data = reqDoc.data();
    if (data.manual && data.challengeTitle?.startsWith('Evento -')) {
      const userRef = doc(db, 'users', data.matricolaId);
      const userSnap = await getDoc(userRef);
      if(userSnap.exists()){
          const currentPts = userSnap.data().punti || 0;
          const currentEveningPts = userSnap.data().puntiSerata || 0; 
          
          const newPts =  currentPts - data.puntiRichiesti;
          const newEveningPts = currentEveningPts - data.puntiRichiesti; 
          
          batch.update(userRef, { 
              punti: newPts,
              puntiSerata: newEveningPts 
          });
      }
      batch.delete(reqDoc.ref);
    }
  }

  batch.update(challengeRef, { fantaPropagated: false });
  await batch.commit();
};

// ==========================================
// 🏆 PROPAGAZIONE CLASSIFICA FINALE SERATA
// ==========================================
export const propagateFinalLeaderboard = async () => {
    const qTeams = query(collection(db, 'event_teams'));
    const snap = await getDocs(qTeams);
    const teams = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (teams.length === 0) throw new Error("Nessuna squadra trovata.");

    teams.sort((a, b) => b.score - a.score);

    const scoreGroups = {};
    teams.forEach(t => {
        if (!scoreGroups[t.score]) scoreGroups[t.score] = [];
        scoreGroups[t.score].push(t);
    });

    const distinctScores = Object.keys(scoreGroups).map(Number).sort((a, b) => b - a);
    if (distinctScores.length === 0) return 0;

    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    let updatedUsersCount = 0;

    const updateMembers = async (teamList, points, label) => {
        for (const team of teamList) {
            const members = team.members || [];
            for (const userId of members) {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, { 
                    punti: increment(points),
                    puntiSerata: increment(points) 
                });

                const requestRef = doc(collection(db, 'requests'));
                batch.set(requestRef, {
                    matricolaId: userId,
                    challengeId: 'finale_serata',
                    challengeTitle: `Classifica Serata: ${label}`,
                    puntiRichiesti: points,
                    status: 'approved',
                    manual: true,
                    approvedAt: timestamp,
                    createdAt: timestamp
                });
                updatedUsersCount++;
            }
        }
    };

    const firstPlaceScore = distinctScores[0];
    await updateMembers(scoreGroups[firstPlaceScore], 30, '1° Posto');

    if (distinctScores.length > 1) {
        const secondPlaceScore = distinctScores[1];
        await updateMembers(scoreGroups[secondPlaceScore], 15, '2° Posto');
    }

    await batch.commit();
    return updatedUsersCount;
};
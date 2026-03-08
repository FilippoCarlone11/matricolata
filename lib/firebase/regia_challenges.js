import { db } from './init';
import { collection, doc, getDoc, updateDoc, addDoc, deleteDoc, query, where, getDocs, serverTimestamp, writeBatch, increment } from 'firebase/firestore';


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

      const currentPoints = Number(userSnap.data().punti) || 0;
      const currentEveningPoints = Number(userSnap.data().puntiSerata) || 0; 
      const puntiDaAggiungere = Number(points) || 0;
      
      batch.update(userRef, { 
          punti: currentPoints + puntiDaAggiungere,
          puntiSerata: currentEveningPoints + puntiDaAggiungere
      });

      const requestRef = doc(collection(db, 'requests'));
      const statusText = isWinner ? '1° Posto' : 'Ultimo Posto';
      batch.set(requestRef, {
        matricolaId: userId,
        challengeId: challengeId,
        challengeTitle: `Evento - ${challengeData.title}: ${statusText}`,
        puntiRichiesti: puntiDaAggiungere,
        status: 'approved',
        manual: true,
        isEveningEvent: true, // ✅ FIX
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
          const currentPts = Number(userSnap.data().punti) || 0;
          const currentEveningPts = Number(userSnap.data().puntiSerata) || 0; 
          const puntiDaTogliere = Number(data.puntiRichiesti) || 0;
          
          batch.update(userRef, { 
              punti: currentPts - puntiDaTogliere,
              puntiSerata: currentEveningPts - puntiDaTogliere 
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
            const puntiDaAggiungere = Number(points) || 0;
            
            for (const userId of members) {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const currentPoints = Number(userSnap.data().punti) || 0;
                    const currentEveningPoints = Number(userSnap.data().puntiSerata) || 0;
                    
                    batch.update(userRef, { 
                        punti: currentPoints + puntiDaAggiungere,
                        puntiSerata: currentEveningPoints + puntiDaAggiungere 
                    });
                }

                const requestRef = doc(collection(db, 'requests'));
                batch.set(requestRef, {
                    matricolaId: userId,
                    challengeId: 'finale_serata',
                    challengeTitle: `Classifica Serata: ${label}`,
                    puntiRichiesti: puntiDaAggiungere,
                    status: 'approved',
                    manual: true,
                    isEveningEvent: true, // ✅ FIX
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
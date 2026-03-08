import { db } from './init';
import { collection, doc, getDoc, updateDoc, addDoc, query, where, getDocs, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';

// HELPER: Riconoscimento "Alcolico"
export const isDrinkRelated = (titleOrId) => {
  if (!titleOrId) return false;
  const t = titleOrId.toLowerCase();
  const keywords = ['fegato', 'drink', 'cocktail', 'shot', 'shottino', 'chupito', 'birra', 'beve', 'bere', 'alcol', 'alcool', 'vino', 'calice', 'sbocco', 'brindisi', 'tavolo', 'goccia'];
  return keywords.some(word => t.includes(word));
};

// HELPER: Riconoscimento "Serata"
export const isEveningRelated = (titleOrId) => {
  if (!titleOrId) return false;
  const t = titleOrId.toLowerCase();
  return t.includes('matricolata') || t.includes('serata') || t.includes('discoteca') || t.includes('locale');
};

export const createRequest = async (matricolaId, challengeId, points, photoProof = null) => {
  await addDoc(collection(db, 'requests'), {
    matricolaId, challengeId, puntiRichiesti: points, photoProof: photoProof, status: 'pending', createdAt: serverTimestamp()
  });
};

export const getUserRequests = async (userId) => {
  const q = query(collection(db, 'requests'), where('matricolaId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const onPendingRequestsChange = (callback) => {
  const q = query(collection(db, 'requests'), where('status', '==', 'pending'));
  return onSnapshot(q, async (snapshot) => {
    const requestsProm = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const targetUserId = data.matricolaId || data.userId;
      let userData = { displayName: 'Sconosciuto', photoURL: null };
      if (targetUserId) {
        try {
          const userSnap = await getDoc(doc(db, 'users', targetUserId));
          if (userSnap.exists()) userData = userSnap.data();
        } catch (e) { }
      }
      let challengeName = data.challengeName || data.challengeTitle || 'Sfida';
      let challengeIcon = '❓';
      if (data.challengeId && data.challengeId.length > 15) {
        try {
          const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
          if (cSnap.exists()) {
            const cData = cSnap.data();
            challengeName = cData.titolo;
            challengeIcon = cData.icon || '🏆';
          }
        } catch (e) { }
      }
      return { id: docSnap.id, ...data, matricolaId: targetUserId, userName: userData.displayName, userPhoto: userData.photoURL, challengeName, challengeIcon };
    });
    const results = await Promise.all(requestsProm);
    callback(results.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)));
  });
};

export const approveRequest = async (requestId, matricolaId, points) => {
  if (!matricolaId) throw new Error("ID Matricola mancante");
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'requests', requestId);
    const userRef = doc(db, 'users', matricolaId);
    const reqDoc = await transaction.get(requestRef);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists() || !reqDoc.exists()) throw "Dati non trovati";

    const reqData = reqDoc.data();
    const userData = userDoc.data(); // Prendiamo i dati dell'utente per denormalizzarli
    
    let isEvening = false;
    let isDrink = false;
    let finalChallengeName = reqData.challengeTitle || reqData.challengeName || 'Sfida'; 

    if (reqData.challengeId && reqData.challengeId.length > 15) {
        const challengeRef = doc(db, 'challenges', reqData.challengeId);
        const challengeDoc = await transaction.get(challengeRef);
        if (challengeDoc.exists()) {
            const cData = challengeDoc.data();
            if (cData.isEveningEvent) isEvening = true;
            if (isDrinkRelated(cData.titolo)) isDrink = true;
            finalChallengeName = cData.titolo; // Recuperiamo il nome esatto
        }
    } else if (isDrinkRelated(reqData.challengeTitle) || isDrinkRelated(reqData.challengeName)) {
        isDrink = true;
    }

    const puntiDaAggiungere = Number(points) || 0;
    const currentPoints = Number(userData.punti) || 0;
    const currentEveningPoints = Number(userData.puntiSerata) || 0;
    const currentDrinks = Number(userData.drinkCount) || 0;

    transaction.update(requestRef, { 
        status: 'approved', 
        approvedAt: serverTimestamp(), 
        isEveningEvent: isEvening, 
        isDrinkEvent: isDrink,
        // <--- DENORMALIZZAZIONE: SALVIAMO TUTTO NELLA REQUEST
        userName: userData.displayName || 'Sconosciuto', 
        userPhoto: userData.photoURL || null,
        challengeName: finalChallengeName
    });
    
    const userUpdates = { punti: currentPoints + puntiDaAggiungere };
    if (isEvening) userUpdates.puntiSerata = currentEveningPoints + puntiDaAggiungere; 
    if (isDrink) userUpdates.drinkCount = currentDrinks + 1;
    
    transaction.update(userRef, userUpdates);
  });
};

export const revokeApprovedRequest = async (requestId, userId, clientPoints) => {
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'requests', requestId);
    const userRef = doc(db, 'users', userId);
    const reqDoc = await transaction.get(requestRef);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists() || !reqDoc.exists()) throw "Dati non trovati";

    const reqData = reqDoc.data();
    const puntiDaRimuovere = Number(reqData.puntiRichiesti) || Number(clientPoints) || 0;
    let isEvening = reqData.isEveningEvent === true;
    let isDrink = reqData.isDrinkEvent === true;
    
    if (!isEvening && reqData.challengeId && reqData.challengeId.length > 15) {
        const challengeRef = doc(db, 'challenges', reqData.challengeId);
        const challengeDoc = await transaction.get(challengeRef);
        if (challengeDoc.exists()) {
            if (challengeDoc.data().isEveningEvent) isEvening = true;
            if (isDrinkRelated(challengeDoc.data().titolo)) isDrink = true;
        }
    }

    transaction.update(requestRef, { status: 'revoked', revokedAt: serverTimestamp() });
    
    const currentPoints = Number(userDoc.data().punti) || 0;
    const currentEveningPoints = Number(userDoc.data().puntiSerata) || 0;
    const currentDrinks = Number(userDoc.data().drinkCount) || 0;

    const userUpdates = { punti: currentPoints - puntiDaRimuovere };
    if (isEvening) userUpdates.puntiSerata = currentEveningPoints - puntiDaRimuovere;
    if (isDrink) userUpdates.drinkCount = Math.max(0, currentDrinks - 1);
    
    transaction.update(userRef, userUpdates);
  });
};

export const rejectRequest = async (requestId) => {
  await updateDoc(doc(db, 'requests', requestId), { status: 'rejected', rejectedAt: serverTimestamp() });
};

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
      } catch (e) { }
    }
    return { id: docSnap.id, ...data, challengeName };
  }));
  return requests.sort((a, b) => (b.approvedAt?.toDate() || 0) - (a.approvedAt?.toDate() || 0));
};

export const manualAddPoints = async (userId, points, reason) => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw "Utente non trovato";

    const userData = userDoc.data();
    let isDrink = isDrinkRelated(reason);
    let isEvening = isEveningRelated(reason);
    let currentPunti = Number(userData.punti) || 0;
    let currentDrinks = Number(userData.drinkCount) || 0;
    let currentEveningPoints = Number(userData.puntiSerata) || 0;
    
    let updates = { punti: currentPunti + points };
    if(isDrink) updates.drinkCount = currentDrinks + 1; 
    if(isEvening) updates.puntiSerata = currentEveningPoints + points;

    transaction.update(userRef, updates);

    const requestRef = doc(collection(db, 'requests'));
    transaction.set(requestRef, {
      matricolaId: userId, 
      challengeId: reason || 'Bonus Manuale', 
      challengeTitle: reason || 'Bonus Manuale',
      puntiRichiesti: points, status: 'approved', manual: true, isDrinkEvent: isDrink, isEveningEvent: isEvening,
      approvedAt: serverTimestamp(), createdAt: serverTimestamp(),
      // <--- DENORMALIZZAZIONE
      challengeName: reason || 'Bonus Manuale',
      userName: userData.displayName || 'Sconosciuto', 
      userPhoto: userData.photoURL || null
    });
  });
};

export const assignExistingChallenge = async (userId, challengeId, points, title) => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw "Utente non trovato";

    const userData = userDoc.data();
    let isEvening = false;
    let isDrink = isDrinkRelated(title);
    let isEveningTitle = isEveningRelated(title);

    if (challengeId && challengeId.length > 15) {
        const challengeRef = doc(db, 'challenges', challengeId);
        const challengeDoc = await transaction.get(challengeRef);
        if (challengeDoc.exists()) {
            const cData = challengeDoc.data();
            if (cData.isEveningEvent) isEvening = true;
            if (isDrinkRelated(cData.titolo)) isDrink = true;
            if (isEveningRelated(cData.titolo)) isEveningTitle = true;
        }
    }
    
    const finalIsEvening = isEvening || isEveningTitle;
    const puntiDaAggiungere = Number(points) || 0;
    const currentPoints = Number(userData.punti) || 0;
    const currentEveningPoints = Number(userData.puntiSerata) || 0;
    const currentDrinks = Number(userData.drinkCount) || 0;
    
    const userUpdates = { punti: currentPoints + puntiDaAggiungere };
    if (finalIsEvening) userUpdates.puntiSerata = currentEveningPoints + puntiDaAggiungere;
    if (isDrink) userUpdates.drinkCount = currentDrinks + 1;

    transaction.update(userRef, userUpdates);

    const requestRef = doc(collection(db, 'requests'));
    transaction.set(requestRef, {
      matricolaId: userId, challengeId: challengeId, challengeTitle: title, puntiRichiesti: puntiDaAggiungere,
      status: 'approved', manual: true, isEveningEvent: finalIsEvening, isDrinkEvent: isDrink,
      approvedAt: serverTimestamp(), createdAt: serverTimestamp(),
      // <--- DENORMALIZZAZIONE
      challengeName: title || 'Sfida',
      userName: userData.displayName || 'Sconosciuto', 
      userPhoto: userData.photoURL || null
    });
  });
};

export const updateRequestDate = async (requestId, newDate) => {
  const requestRef = doc(db, 'requests', requestId);
  await updateDoc(requestRef, { approvedAt: newDate, createdAt: newDate });
};
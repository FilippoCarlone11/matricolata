import { db } from './init';
import { collection, getDoc, doc, query, getDocs, orderBy, limit } from 'firebase/firestore';



export const getGlobalFeed = async () => {
  try {
    let q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(20));

    let snapshot;
    try { snapshot = await getDocs(q); }
    catch (e) {
      q = query(collection(db, 'requests'), orderBy('timestamp', 'desc'), limit(20));
      snapshot = await getDocs(q);
    }

    const feedItems = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();

      // ==========================================
      // 1. CASO NUOVE RICHIESTE (Super Veloce, 0 letture extra)
      // Se abbiamo già salvato il nome utente nella richiesta, usiamo quello!
      // ==========================================
      if (data.userName && data.challengeName) {
          return {
              id: docSnap.id,
              ...data,
              timestamp: data.createdAt || data.timestamp || data.approvedAt,
              userName: data.userName,
              userPhoto: data.userPhoto || null,
              challengeName: data.challengeName,
              isHidden: data.isHidden || false 
          };
      }

      // ==========================================
      // 2. CASO VECCHIE RICHIESTE (Il "Pezzotto" per apparare le robe vecchie)
      // Se mancano i nomi, andiamo a leggerli da Firebase come facevamo prima
      // ==========================================
      const targetUserId = data.matricolaId || data.userId;
      let userData = { displayName: 'Sconosciuto', photoURL: null };

      if (targetUserId) {
        try {
          const userSnap = await getDoc(doc(db, 'users', targetUserId));
          if (userSnap.exists()) userData = userSnap.data();
        } catch (e) { }
      }

      let challengeName = data.challengeName || data.challengeTitle || data.challengeId;
      let isHidden = false; 

      if (data.challengeId && data.challengeId.length > 15) {
        try {
          const cSnap = await getDoc(doc(db, 'challenges', data.challengeId));
          if (cSnap.exists()) {
            const cData = cSnap.data();
            if (!data.challengeTitle && !data.manual) challengeName = cData.titolo;
            isHidden = cData.hidden || false; 
          }
        } catch (e) { }
      }

      return {
        id: docSnap.id,
        ...data,
        timestamp: data.createdAt || data.timestamp || data.approvedAt,
        userName: userData.displayName || 'Utente',
        userPhoto: userData.photoURL,
        challengeName,
        isHidden 
      };
    }));

    return feedItems;
  } catch (error) {
    console.error("Errore feed:", error);
    return [];
  }
};

// NB: le impostazioni di sistema vivono in `system.js` e lo spostamento data
// richiesta in `requests.js`. Le copie che stavano qui erano duplicate (e
// rotte: usavano setDoc/updateDoc non importati) e sono state rimosse.
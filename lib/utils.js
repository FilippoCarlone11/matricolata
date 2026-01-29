/**
 * Controlla se una data timestamp è di oggi
 */
export const isToday = (timestamp) => {
  if (!timestamp) return false;
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const today = new Date();
  
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

/**
 * Controlla se un utente può richiedere una sfida
 * @param {Object} challenge - La sfida
 * @param {Array} userRequests - Le richieste dell'utente
 * @returns {boolean} - true se può richiedere, false altrimenti
 */
export const canRequestChallenge = (challenge, userRequests) => {
  // Filtra le richieste per questa specifica sfida
  const challengeRequests = userRequests.filter(req => req.challengeId === challenge.id);
  
  if (challenge.type === 'oneshot') {
    // One-shot: non può richiedere se ha già una richiesta (pending, approved, o rejected)
    return challengeRequests.length === 0;
  }
  
  if (challenge.type === 'daily') {
    // Daily: controlla se ha già fatto richiesta oggi
    const todayRequest = challengeRequests.find(req => isToday(req.createdAt));
    return !todayRequest;
  }
  
  return true;
};

/**
 * Filtra le sfide che l'utente può vedere
 */
export const getAvailableChallenges = (allChallenges, userRequests) => {
  return allChallenges.filter(challenge => 
    canRequestChallenge(challenge, userRequests)
  );
};

/**
 * Ottiene lo storico punti approvati di un utente
 */
export const getApprovedHistory = (userRequests, allChallenges) => {
  return userRequests
    .filter(req => req.status === 'approved')
    .map(req => {
      const challenge = allChallenges.find(c => c.id === req.challengeId);
      return {
        ...req,
        challengeName: challenge?.titolo || 'Sfida eliminata',
        challengeIcon: challenge?.icon || '🎯'
      };
    })
    .sort((a, b) => {
      const dateA = a.approvedAt?.toDate ? a.approvedAt.toDate() : new Date(a.approvedAt || 0);
      const dateB = b.approvedAt?.toDate ? b.approvedAt.toDate() : new Date(b.approvedAt || 0);
      return dateB - dateA;
    });
};

/**
 * Calcola i punti totali di una squadra
 */
export const calculateSquadraPoints = (squadra, allUsers) => {
  if (!squadra || !squadra.matricole) return 0;
  
  return squadra.matricole.reduce((total, matricolaId) => {
    const user = allUsers.find(u => u.id === matricolaId);
    if (!user) return total;
    
    const basePoints = user.punti || 0;
    const bonus = matricolaId === squadra.capitanoId ? basePoints * 0.5 : 0;
    
    return total + basePoints + bonus;
  }, 0);
};

/**
 * Formatta una data Firebase Timestamp
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Ottiene il badge di stato per le richieste
 */
export const getStatusBadge = (status) => {
  const badges = {
    pending: { label: '⏱ In attesa', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    approved: { label: '✓ Approvata', color: 'bg-green-100 text-green-700 border-green-300' },
    rejected: { label: '✕ Rifiutata', color: 'bg-red-100 text-red-700 border-red-300' }
  };
  
  return badges[status] || badges.pending;
};
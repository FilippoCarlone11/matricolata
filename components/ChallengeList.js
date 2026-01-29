'use client';

import { useState, useEffect } from 'react';
import { getChallenges, getUserRequests, createRequest } from '@/lib/firebase';
import { getAvailableChallenges, getStatusBadge } from '@/lib/utils';
import { Target, Zap, Calendar, CheckCircle } from 'lucide-react';

export default function ChallengeList({ currentUser }) {
  const [challenges, setChallenges] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(null);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      const [challengesData, requestsData] = await Promise.all([
        getChallenges(),
        getUserRequests(currentUser.id)
      ]);
      
      setChallenges(challengesData);
      setUserRequests(requestsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (challenge) => {
    setRequesting(challenge.id);
    
    try {
      await createRequest(currentUser.id, challenge.id, challenge.punti);
      // Reload requests
      const updatedRequests = await getUserRequests(currentUser.id);
      setUserRequests(updatedRequests);
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Errore durante la richiesta');
    } finally {
      setRequesting(null);
    }
  };

  // Filter challenges based on user requests
  const availableChallenges = getAvailableChallenges(challenges, userRequests);
  
  // Get requests with status for display
  const challengesWithStatus = challenges.map(challenge => {
    const request = userRequests.find(req => req.challengeId === challenge.id);
    return {
      ...challenge,
      userRequest: request,
      canRequest: availableChallenges.some(c => c.id === challenge.id)
    };
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Target size={28} className="text-red-600" />
          Sfide Disponibili
        </h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
          {availableChallenges.length} attive
        </span>
      </div>

      <div className="space-y-3">
        {challengesWithStatus.map(challenge => {
          const badge = challenge.userRequest ? getStatusBadge(challenge.userRequest.status) : null;
          
          return (
            <div
              key={challenge.id}
              className={`bg-white rounded-2xl p-5 shadow-md border transition-all ${
                challenge.canRequest
                  ? 'border-gray-200 hover:shadow-lg'
                  : 'border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl">{challenge.icon || '🎯'}</span>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 mb-1">
                        {challenge.titolo}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                          {challenge.categoria}
                        </span>
                        
                        {/* Type Badge */}
                        {challenge.type === 'daily' ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                            <Calendar size={12} />
                            Giornaliera
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                            <CheckCircle size={12} />
                            One-Shot
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-red-500 to-orange-500 text-white px-4 py-2 rounded-xl font-black text-lg shadow-lg">
                      +{challenge.punti}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button or Status */}
              {badge ? (
                <div className="mt-3">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
              ) : challenge.canRequest ? (
                <button
                  onClick={() => handleRequest(challenge)}
                  disabled={requesting === challenge.id}
                  className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {requesting === challenge.id ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Zap size={20} />
                      Richiedi Punti
                    </>
                  )}
                </button>
              ) : (
                <div className="text-center py-2 text-gray-500 text-sm font-medium">
                  {challenge.type === 'oneshot' 
                    ? 'Già richiesta' 
                    : 'Disponibile domani'
                  }
                </div>
              )}
            </div>
          );
        })}

        {availableChallenges.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-2xl">
            <Target size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Nessuna sfida disponibile al momento</p>
            <p className="text-gray-400 text-sm mt-1">Torna domani per nuove sfide giornaliere</p>
          </div>
        )}
      </div>
    </div>
  );
}
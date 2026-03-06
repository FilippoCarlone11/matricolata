'use client';

import { useState, useEffect } from 'react';
import { getApprovedRequestsByUser } from '@/lib/firebase';
import { Award, Clock, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function StoricoPunti({ t, currentUser, systemSettings }) {
  const [groupedHistory, setGroupedHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false); // STATO CARICAMENTO PDF

  // --- LOGICA CACHE LEGATA AL FEED ---
  const CACHE_KEY = `storico_${currentUser.id}`;
  
  const isFeedCacheEnabled = systemSettings?.feedCacheEnabled ?? true;
  const feedCacheMinutes = systemSettings?.feedCacheDuration ?? 2; 

  useEffect(() => {
    const loadHistory = async () => {
      try {
        if (!isFeedCacheEnabled) {
            localStorage.removeItem(CACHE_KEY);
        } else {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const now = new Date().getTime();
                const diffMinutes = (now - timestamp) / 1000 / 60;

                if (diffMinutes < feedCacheMinutes) {
                    setGroupedHistory(data);
                    setLoading(false);
                    return;
                }
            }
        }

        const data = await getApprovedRequestsByUser(currentUser.id);
        
        const grouped = data.reduce((acc, item) => {
          const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
          const dateStr = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
          if (!acc[dateStr]) acc[dateStr] = [];
          acc[dateStr].push(item);
          return acc;
        }, {});

        if (isFeedCacheEnabled) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: grouped,
                timestamp: new Date().getTime()
            }));
        }

        setGroupedHistory(grouped);
      } catch (e) {
        console.error("Errore Storico:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
  }, [currentUser.id, isFeedCacheEnabled, feedCacheMinutes]);

  // ==========================================
  // HELPER: Calcola le dimensioni originali della foto
  // ==========================================
  const getImageDimensions = (base64) => {
      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: 0, h: 0 });
          img.src = base64;
      });
  };

  // ==========================================
  // FUNZIONE PDF STILE "NEWS FEED POST"
  // ==========================================
  const scaricaMioPDF = async () => {
      setIsGeneratingPDF(true);

      try {
          // 1. Scarichiamo l'array piatto per facilitare l'impaginazione PDF
          const flatHistory = await getApprovedRequestsByUser(currentUser.id);

          const doc = new jsPDF();
          const brandColor = [180, 31, 53];
          const pageWidth = 210;
          const marginX = 14;
          const cardWidth = pageWidth - (marginX * 2);

          // --- HEADER PRINCIPALE ---
          doc.setFillColor(...brandColor);
          doc.rect(0, 0, pageWidth, 40, 'F'); 

          doc.setTextColor(255, 255, 255);
          doc.setFontSize(22);
          doc.setFont("helvetica", "bold");
          doc.text("FANTA MATRICOLATA", marginX, 20);
          
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text("Il Tuo Album dei Ricordi Ufficiale", marginX, 28); // Testo header PDF più carino

          // --- DETTAGLI UTENTE ---
          doc.setTextColor(50, 50, 50);
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(`Matricola: ${currentUser.displayName || 'Sconosciuto'}`, marginX, 55);
          if(currentUser.teamName) doc.text(`Squadra: ${currentUser.teamName}`, marginX, 62);
          
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...brandColor);
          doc.text(`PUNTI TOTALI: ${currentUser.punti || 0} pt`, 130, 55);

          let currentY = 75;

          if (flatHistory.length === 0) {
              doc.setFontSize(12);
              doc.setTextColor(100, 100, 100);
              doc.text("Nessuna attività registrata.", marginX, currentY);
          } else {
              // --- CICLO DISEGNO POST ---
              for (let i = 0; i < flatHistory.length; i++) {
                  const item = flatHistory[i];
                  const dateObj = item.approvedAt?.toDate ? item.approvedAt.toDate() : new Date();
                  const dataStr = dateObj.toLocaleDateString('it-IT') + ' - ' + dateObj.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
                  const isMalus = item.puntiRichiesti < 0;
                  const puntiStr = isMalus ? `${item.puntiRichiesti}` : `+${item.puntiRichiesti}`;
                  
                  let actionText = item.manual ? "Assegnato da Admin" : "Completato";
                  if (item.status === 'rejected') actionText = "Rifiutato";

                  const hasPhoto = item.photoProof && item.photoProof.startsWith('data:image');
                  let printImgW = 0;
                  let printImgH = 0;

                  // Calcolo proporzioni intelligenti per la foto
                  if (hasPhoto) {
                      const dims = await getImageDimensions(item.photoProof);
                      if (dims.w > 0 && dims.h > 0) {
                          const maxW = cardWidth - 12; // Lascia margine
                          const maxH = 90; // Altezza max di sicurezza sul PDF
                          const ratio = Math.min(maxW / dims.w, maxH / dims.h);
                          printImgW = dims.w * ratio;
                          printImgH = dims.h * ratio;
                      }
                  }

                  // Calcolo altezza dinamica testo
                  doc.setFontSize(12);
                  doc.setFont("helvetica", "bold");
                  const challengeName = item.challengeName || "Sfida non specificata";
                  const titleLines = doc.splitTextToSize(challengeName, cardWidth - 30);
                  const textHeight = titleLines.length * 6; 

                  // Calcolo altezza totale card
                  const basePadding = 18; 
                  let cardHeight = basePadding + textHeight;
                  if (hasPhoto && printImgH > 0) cardHeight += printImgH + 6;

                  // Salto pagina se finisce lo spazio
                  if (currentY + cardHeight > 280) {
                      doc.addPage();
                      currentY = 20;
                  }

                  // 1. Sfondo della Card
                  doc.setFillColor(252, 252, 252);
                  doc.setDrawColor(230, 230, 230);
                  doc.roundedRect(marginX, currentY, cardWidth, cardHeight, 3, 3, 'FD');

                  // 2. Intestazione Post
                  doc.setFontSize(9);
                  doc.setFont("helvetica", "normal");
                  doc.setTextColor(150, 150, 150);
                  doc.text(dataStr, marginX + 4, currentY + 7);
                  
                  doc.setFont("helvetica", "bold");
                  if (item.status === 'rejected') doc.setTextColor(220, 38, 38);
                  else if (item.manual) doc.setTextColor(100, 100, 100);
                  else doc.setTextColor(22, 163, 74);
                  doc.text(actionText.toUpperCase(), marginX + cardWidth - 4, currentY + 7, { align: 'right' });

                  // 3. Titolo Sfida e Punti
                  doc.setFontSize(12);
                  doc.setTextColor(40, 40, 40);
                  doc.setFont("helvetica", "bold");
                  doc.text(titleLines, marginX + 4, currentY + 15);

                  doc.setFontSize(14);
                  if (item.status === 'rejected') doc.setTextColor(150, 150, 150);
                  else if (isMalus) doc.setTextColor(220, 38, 38);
                  else doc.setTextColor(22, 163, 74);
                  doc.text(item.status === 'rejected' ? '0' : puntiStr, marginX + cardWidth - 4, currentY + 15, { align: 'right' });

                  // 4. Immagine Allegata (Proporzionata)
                  if (hasPhoto && printImgW > 0) {
                      try {
                          const imgX = marginX + (cardWidth - printImgW) / 2; 
                          const imgY = currentY + 15 + textHeight;
                          doc.addImage(item.photoProof, imgX, imgY, printImgW, printImgH, undefined, 'FAST');
                      } catch (e) {
                          console.error("Errore PDF Immagine", e);
                          doc.setFontSize(9);
                          doc.setTextColor(200, 100, 100);
                          doc.text("[Errore rendering immagine]", marginX + cardWidth/2, currentY + 25 + textHeight, { align: 'center' });
                      }
                  }

                  currentY += cardHeight + 6; // Spazio successivo
              }
          }

          // --- FOOTER ---
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.setFont("helvetica", "normal");
          for(let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.text(`Generato il: ${new Date().toLocaleString('it-IT')} - Pagina ${i} di ${pageCount}`, marginX, 290);
          }

          doc.save(`FantaMatricolata_${currentUser.displayName.replace(/\s+/g, '_')}.pdf`);

      } catch (error) {
          console.error("Errore PDF:", error);
          alert(`Impossibile generare il PDF: ${error.message}`);
      } finally {
          setIsGeneratingPDF(false);
      }
  };

  if (loading) return <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div></div>;

  return (
    <div className="mt-8 pb-12">
      
      {/* HEADER RIORGANIZZATO PER IL PULSANTE ROSSO BELLEZZA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8 border-b border-gray-100 pb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Award size={28} className="text-[#B41F35]" /> {t("Il Tuo Storico Punti")}
            </h2>
            {isFeedCacheEnabled && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1 uppercase font-bold bg-gray-100 px-2.5 py-1 rounded-full w-fit mt-2.5">
                 <Clock size={10}/> Aggiornato ogni {feedCacheMinutes} min
              </span>
            )}
          </div>
          
          
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8 border-b border-gray-100 pb-6">
        {/* PULSANTE "RICORDO" ROSSO E CARINO */}
          <button 
              onClick={scaricaMioPDF}
              disabled={isGeneratingPDF || Object.keys(groupedHistory).length === 0}
              className={`w-full md:w-auto px-5 py-3.5 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2.5 ${isGeneratingPDF ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#B41F35] text-white hover:bg-[#90192a] active:scale-95'}`}
              title="Scarica il tuo Album dei Ricordi"
          >
              {isGeneratingPDF ? <Loader2 size={20} className="animate-spin"/> : <Download size={20} />}
              <span className="text-sm">
                {isGeneratingPDF ? 'Creando il tuo ricordo...' : t('Scarica un ricordo della tua FantaMatricolata')}
              </span>
          </button>
      </div>

      {Object.keys(groupedHistory).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500">{t("Nessuna attività registrata.")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedHistory).map(date => (
            <div key={date} className="relative">
              <div className="absolute left-2.5 top-8 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-red-100 border-2 border-[#B41F35] z-10"></div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider capitalize">{date}</h3>
              </div>
              <div className="pl-8 space-y-3">
                {groupedHistory[date].map((item) => {
                  const isMalus = item.puntiRichiesti < 0;
                  return (
                    <div key={item.id} className={`bg-white border rounded-2xl p-4 shadow-sm flex justify-between items-center ${isMalus ? 'border-red-100 bg-red-50/50' : 'border-gray-100'}`}>
                      <div>
                        <h3 className={`font-bold ${isMalus ? 'text-red-900' : 'text-gray-900'} flex items-center gap-2`}>
                            {item.challengeName || "Sfida"}
                            {isMalus && <span className="text-[10px] bg-red-600 text-white px-1.5 rounded uppercase">{t("Malus")}</span>}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.manual ? (isMalus ? t('Malus dagli admin') : 'Bonus dagli admin') : t('Completato')}
                        </p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-xl font-black text-sm border ${isMalus ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                        {item.puntiRichiesti > 0 ? '+' : ''}{item.puntiRichiesti}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
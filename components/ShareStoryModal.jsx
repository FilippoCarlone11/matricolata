'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Share2, Download, Loader2 } from 'lucide-react';

// =====================================================================
//  ShareStoryModal
//  Genera una "storia" 1080x1920 brandizzata a partire da un post del
//  feed (stile Spotify Wrapped) e la condivide via Web Share API
//  (ideale per Instagram da mobile) con fallback al download.
// =====================================================================

const W = 1080;
const H = 1920;
const BRAND = '#B41F35';

// Carica un'immagine SENZA contaminare il canvas: la scarica come blob
// (stessa-origine via objectURL) così toBlob/toDataURL non lanciano
// SecurityError sulle foto remote (es. avatar Google).
async function loadImageSafe(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = objUrl;
    });
    return { img, objUrl };
  } catch {
    return null;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Spezza il testo su più righe rispettando una larghezza massima
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = (text || '').split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    trimmed[maxLines - 1] = trimmed[maxLines - 1].replace(/\.*$/, '') + '…';
    return trimmed;
  }
  return lines;
}

function resolveDate(item) {
  const raw = item?._cachedDate || item?.createdAt || item?.timestamp || item?.approvedAt;
  if (!raw) return null;
  if (typeof raw === 'string') return new Date(raw);
  return raw.toDate ? raw.toDate() : new Date(raw);
}

export default function ShareStoryModal({ item, onClose, t }) {
  const tr = (text) => (t ? t(text) : text);
  const canvasRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [working, setWorking] = useState(false);

  const isMalus = Number(item.puntiRichiesti) < 0;
  const points = Number(item.puntiRichiesti) || 0;

  useEffect(() => {
    let objUrls = [];
    let cancelled = false;

    const draw = async () => {
      setRendering(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // --- SFONDO: gradiente brandizzato (rosso per bonus, antracite per malus) ---
      const grad = ctx.createLinearGradient(0, 0, W, H);
      if (isMalus) {
        grad.addColorStop(0, '#1f2937');
        grad.addColorStop(1, '#0b0f1a');
      } else {
        grad.addColorStop(0, '#D62B44');
        grad.addColorStop(1, '#7A1525');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Bolle decorative
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(W - 120, 220, 260, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(140, H - 320, 200, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // Carico avatar e (se presente) la foto-prova del post
      const avatar = await loadImageSafe(item.userPhoto);
      if (avatar) objUrls.push(avatar.objUrl);
      const hasProof = typeof item.photoProof === 'string' && item.photoProof.startsWith('data:image');
      const proof = hasProof ? await loadImageSafe(item.photoProof) : null;
      if (proof) objUrls.push(proof.objUrl);

      const pointsStr = (points > 0 ? '+' : '') + points;
      const date = resolveDate(item);
      const dateStr = date ? date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

      // Helper riutilizzabile: avatar circolare (o iniziali) centrato in (acx, acy) raggio ar
      const drawAvatar = (acx, acy, ar) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(acx, acy, ar + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(acx, acy, ar, 0, Math.PI * 2);
        ctx.clip();
        if (avatar) {
          const s = Math.max((2 * ar) / avatar.img.width, (2 * ar) / avatar.img.height);
          const dw = avatar.img.width * s;
          const dh = avatar.img.height * s;
          ctx.drawImage(avatar.img, acx - dw / 2, acy - dh / 2, dw, dh);
        } else {
          ctx.fillStyle = isMalus ? '#374151' : BRAND;
          ctx.fillRect(acx - ar, acy - ar, 2 * ar, 2 * ar);
          ctx.fillStyle = '#ffffff';
          ctx.font = `900 ${Math.round(ar * 0.85)}px Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const initials = (item.userName || '?').trim().slice(0, 2).toUpperCase();
          ctx.fillText(initials, acx, acy + 4);
          ctx.textBaseline = 'alphabetic';
        }
        ctx.restore();
      };

      if (proof) {
        // ===================== LAYOUT CON FOTO-PROVA =====================
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 30px Arial, sans-serif';
        ctx.fillText('FANTAMATRICOLATA', W / 2, 92);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 56px Arial, sans-serif';
        ctx.fillText('matricolata.it', W / 2, 158);

        // Header utente: avatar piccolo + nome (gruppo centrato)
        ctx.font = '900 50px Arial, sans-serif';
        const fullName = item.userName || 'Anonimo';
        let shownName = fullName;
        const maxNameW = W - 320;
        while (ctx.measureText(shownName).width > maxNameW && shownName.length > 3) {
          shownName = shownName.slice(0, -2);
        }
        if (shownName !== fullName) shownName = shownName.replace(/\s+$/, '') + '…';
        const avR = 56;
        const gap = 26;
        const nameW = ctx.measureText(shownName).width;
        const groupX = (W - (avR * 2 + gap + nameW)) / 2;
        const headCy = 270;
        drawAvatar(groupX + avR, headCy, avR);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(shownName, groupX + avR * 2 + gap, headCy + 2);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'center';

        // Foto-prova in cornice quadrata (cover-fit)
        const pw = 900, ph = 900;
        const px = (W - pw) / 2;
        const py = 360;
        ctx.save();
        roundRect(ctx, px, py, pw, ph, 36);
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
        ctx.clip();
        const sc = Math.max(pw / proof.img.width, ph / proof.img.height);
        const idw = proof.img.width * sc;
        const idh = proof.img.height * sc;
        ctx.drawImage(proof.img, px + (pw - idw) / 2, py + (ph - idh) / 2, idw, idh);
        ctx.restore();

        // Sticker punti, sovrapposto in basso a destra
        ctx.font = '900 92px Arial, sans-serif';
        const stW = ctx.measureText(pointsStr).width + 80;
        const stH = 150;
        const stX = px + pw - stW - 28;
        const stY = py + ph - stH / 2 - 26;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 8;
        roundRect(ctx, stX, stY, stW, stH, 32);
        ctx.fillStyle = isMalus ? '#0b0f1a' : '#ffffff';
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = isMalus ? '#fb7185' : BRAND;
        ctx.textBaseline = 'middle';
        ctx.fillText(pointsStr, stX + stW / 2, stY + stH / 2 + 4);
        ctx.textBaseline = 'alphabetic';

        // Etichetta azione (pill) sotto la foto
        const label = (isMalus ? tr('HA PRESO UN MALUS') : tr('HA PRESO UN BONUS')).toUpperCase();
        ctx.font = '800 36px Arial, sans-serif';
        const pillW = ctx.measureText(label).width + 64;
        const pillY = py + ph + 64;
        ctx.fillStyle = isMalus ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.18)';
        roundRect(ctx, (W - pillW) / 2, pillY, pillW, 72, 36);
        ctx.fill();
        ctx.fillStyle = isMalus ? '#fecaca' : '#ffffff';
        ctx.fillText(label, W / 2, pillY + 48);

        // Titolo sfida
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 54px Arial, sans-serif';
        const titleLines = wrapLines(ctx, item.challengeName || tr('Azione'), W - 200, 2);
        let ty = pillY + 150;
        titleLines.forEach((l) => { ctx.fillText(l, W / 2, ty); ty += 66; });

        // Data
        if (dateStr) {
          ctx.font = '600 34px Arial, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(dateStr, W / 2, 1855);
        }
      } else {
        // ===================== LAYOUT SENZA FOTO (card classica) =====================
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 40px Arial, sans-serif';
        ctx.fillText('FANTAMATRICOLATA', W / 2, 150);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 64px Arial, sans-serif';
        ctx.fillText('matricolata.it', W / 2, 226);

        drawAvatar(W / 2, 540, 175);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 78px Arial, sans-serif';
        const nameLines = wrapLines(ctx, item.userName || 'Anonimo', W - 160, 2);
        let ny = 820;
        nameLines.forEach((l) => { ctx.fillText(l, W / 2, ny); ny += 86; });

        const label = (isMalus ? tr('HA PRESO UN MALUS') : tr('HA PRESO UN BONUS')).toUpperCase();
        ctx.font = '800 38px Arial, sans-serif';
        const pillW = ctx.measureText(label).width + 70;
        const pillY = ny + 6;
        ctx.fillStyle = isMalus ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.18)';
        roundRect(ctx, (W - pillW) / 2, pillY, pillW, 78, 39);
        ctx.fill();
        ctx.fillStyle = isMalus ? '#fecaca' : '#ffffff';
        ctx.fillText(label, W / 2, pillY + 52);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 60px Arial, sans-serif';
        const titleLines = wrapLines(ctx, item.challengeName || tr('Azione'), W - 200, 3);
        let ty = pillY + 200;
        titleLines.forEach((l) => { ctx.fillText(l, W / 2, ty); ty += 74; });

        ctx.font = '900 300px Arial, sans-serif';
        ctx.fillStyle = isMalus ? '#fb7185' : '#ffffff';
        ctx.fillText(pointsStr, W / 2, 1560);
        ctx.font = '800 44px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(tr('PUNTI'), W / 2, 1620);

        if (dateStr) {
          ctx.font = '600 36px Arial, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(dateStr, W / 2, 1800);
        }
      }

      if (!cancelled) setRendering(false);
    };

    draw();

    return () => {
      cancelled = true;
      objUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const getBlob = () =>
    new Promise((resolve) => canvasRef.current.toBlob((b) => resolve(b), 'image/png', 0.95));

  const handleShare = async () => {
    setWorking(true);
    try {
      const blob = await getBlob();
      const file = new File([blob], 'matricolata-story.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'FantaMatricolata',
          text: `${item.userName} ${isMalus ? 'ha preso un malus' : 'ha preso un bonus'}: ${item.challengeName}!`,
        });
      } else {
        // Desktop / browser senza condivisione file: scarichiamo
        downloadBlob(blob);
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Share error:', e);
    } finally {
      setWorking(false);
    }
  };

  const downloadBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matricolata-${(item.userName || 'storia').replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    setWorking(true);
    try {
      downloadBlob(await getBlob());
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 p-3 rounded-full z-10"
        onClick={onClose}
      >
        <X size={24} />
      </button>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {/* Anteprima: canvas a piena risoluzione, ridimensionato via CSS */}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-2xl shadow-2xl"
          style={{ width: 'min(78vw, 300px)', height: 'auto', display: 'block' }}
        />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
            <Loader2 className="animate-spin text-white" size={40} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-6" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleShare}
          disabled={rendering || working}
          className="flex items-center gap-2 bg-white text-[#B41F35] px-6 py-3.5 rounded-2xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
        >
          {working ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
          {tr('Condividi storia')}
        </button>
        <button
          onClick={handleDownload}
          disabled={rendering || working}
          className="flex items-center gap-2 bg-white/15 text-white px-5 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/25 active:scale-95 transition-all disabled:opacity-50"
        >
          <Download size={18} />
          {tr('Scarica')}
        </button>
      </div>
    </div>
  );
}

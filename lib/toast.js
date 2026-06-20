// Toast globale event-based: nessun provider da infilare nei componenti.
// Uso: import { toast } from '@/lib/toast';  toast.success('Fatto!');
// Un singolo <Toaster/> montato nel layout ascolta gli eventi e li mostra.

function emit(message, type) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('app-toast', { detail: { message: String(message), type } })
  );
}

export const toast = Object.assign((m) => emit(m, 'info'), {
  success: (m) => emit(m, 'success'),
  error: (m) => emit(m, 'error'),
  info: (m) => emit(m, 'info'),
});

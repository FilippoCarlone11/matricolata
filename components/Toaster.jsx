'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const STYLES = {
  success: { icon: CheckCircle2, ring: 'border-green-200', accent: 'text-green-600', bg: 'bg-white' },
  error: { icon: AlertCircle, ring: 'border-red-200', accent: 'text-red-600', bg: 'bg-white' },
  info: { icon: Info, ring: 'border-gray-200', accent: 'text-gray-600', bg: 'bg-white' },
};

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const id = Date.now() + Math.random();
      const { message, type } = e.detail || {};
      setToasts((prev) => [...prev, { id, message, type: STYLES[type] ? type : 'info' }]);
      setTimeout(() => remove(id), 4000);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, [remove]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const s = STYLES[t.type];
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 ${s.bg} border ${s.ring} shadow-lg rounded-2xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300`}
          >
            <Icon size={20} className={`${s.accent} shrink-0`} />
            <p className="text-sm font-medium text-gray-800 flex-1 leading-snug">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-gray-600 shrink-0">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

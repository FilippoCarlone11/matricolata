'use client';

import { AlertCircle, Info, ChevronRight, X } from 'lucide-react';

export default function ActionModal({ isOpen, type = 'info', title, message, onConfirm, onCancel, confirmText = 'Conferma', cancelText = 'Annulla' }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex text-left items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header Dinamico basato sul tipo */}
                <div className={`p-6 border-b border-gray-800 flex items-start gap-4 ${type === 'danger' || type === 'alert' ? 'bg-red-500/10' : type === 'confirm' ? 'bg-yellow-500/10' : 'bg-purple-500/10'}`}>
                    <div className={`p-3 rounded-2xl shrink-0 ${type === 'danger' || type === 'alert' ? 'bg-red-500/20 text-red-500' : type === 'confirm' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-purple-500/20 text-purple-400'}`}>
                        {type === 'danger' || type === 'alert' ? <AlertCircle size={32} /> : type === 'confirm' ? <AlertCircle size={32} /> : <Info size={32} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white leading-tight">{title}</h3>
                        <p className="text-sm text-gray-400 font-medium mt-1">{type === 'danger' ? 'AZIONE CRITICA' : type.toUpperCase() + ' di Sistema'}</p>
                    </div>
                </div>

                {/* Corpo del Messaggio */}
                <div className="p-6">
                    <p className="text-gray-300 text-base leading-relaxed">{message}</p>
                </div>

                {/* Pulsanti Azione */}
                <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex flex-col sm:flex-row gap-3 justify-end items-center">

                    {/* Pulsante Annulla */}
                    {(type === 'confirm' || type === 'info' || type === 'alert' || type === 'danger') && (
                        <button
                            onClick={onCancel}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition-all flex items-center justify-center gap-2 border border-gray-700"
                        >
                            {type === 'alert' || type === 'info' ? 'Chiudi' : cancelText}
                        </button>
                    )}


                    {/* Pulsante Conferma (Per confirm e danger) */}
                    {(type === 'confirm' || type === 'danger') && (
                        <button
                            onClick={onConfirm}
                            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${type === 'danger'
                                ? 'bg-red-600 text-white hover:bg-red-500'
                                : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400'
                                }`}
                        >
                            {confirmText} <ChevronRight size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

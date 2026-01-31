'use client';

import { useState } from 'react';
import { signInWithGoogle, registerWithEmail, loginWithEmail } from '@/lib/firebase';
import { Trophy, Mail, Lock, User, Loader2 } from 'lucide-react';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try { await signInWithGoogle(); } 
    catch (err) { setError('Errore Google Login: ' + err.message); } 
    finally { setLoading(false); }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        if (!name) throw new Error("Inserisci il tuo nome!");
        await registerWithEmail(name, email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err) {
      let msg = err.message;
      if (msg.includes('auth/email-already-in-use')) msg = "Email già registrata.";
      if (msg.includes('auth/invalid-credential')) msg = "Email o Password errati.";
      if (msg.includes('auth/weak-password')) msg = "La password deve essere di almeno 6 caratteri.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-gradient-to-br from-red-600 to-orange-500 p-8 text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4 shadow-inner">
            <Trophy size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Matricolata.it</h1>
          <p className="text-red-100 text-sm mt-1 font-medium">L'app ufficiale per veri fantallenatori</p>
        </div>

        <div className="p-8">
          
          {/* GOOGLE BUTTON (Sempre comodo) */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-50 transition-all shadow-sm mb-6"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M3.58 13.26c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.31H.94C-.19 8.61-.19 13.91.94 16.21l2.64-2.95z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.31l2.64 2.95C5.74 6.77 8.63 5.38 12 5.38z"/></svg>
                Accedi con Google
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-bold text-gray-400 uppercase">Oppure usa Email</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* FORM EMAIL */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            
            {/* Campo Nome (Solo registrazione) */}
            {isRegistering && (
              <div className="relative">
                <User size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input 
                  type="text" placeholder="Nome e Cognome" required={isRegistering}
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full pl-10 p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" />
              <input 
                type="email" placeholder="Email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
              <input 
                type="password" placeholder="Password" required minLength={6}
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>

            {error && <p className="text-red-500 text-xs text-center font-bold bg-red-50 p-2 rounded">{error}</p>}

            <button 
              type="submit" disabled={loading}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-all shadow-lg flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Crea Account' : 'Entra')}
            </button>
          </form>

          {/* SWITCHER */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {isRegistering ? "Hai già un account?" : "Non hai un account?"}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
              className="font-bold text-orange-600 ml-1 hover:underline"
            >
              {isRegistering ? "Accedi" : "Registrati"}
            </button>
          </p>

        </div>
      </div>
    </div>
  );
}
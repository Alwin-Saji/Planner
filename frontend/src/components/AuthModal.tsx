import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { getSupabaseConfig, setSupabaseConfig, getSupabaseClient } from '../supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Supabase connection configuration states
  const [needsConfig, setNeedsConfig] = useState(false);
  const [dbUrl, setDbUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      const client = getSupabaseClient();
      if (!config.url || !config.anonKey || !client) {
        setNeedsConfig(true);
        setDbUrl(config.url);
        setAnonKey(config.anonKey);
      } else {
        setNeedsConfig(false);
      }
      setError(null);
      setMessage(null);
    }
  }, [isOpen]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUrl.trim() || !anonKey.trim()) {
      setError('Provide Supabase URL and API Anon Key.');
      return;
    }
    setSupabaseConfig(dbUrl.trim(), anonKey.trim());
    const client = getSupabaseClient();
    if (!client) {
      setError('Invalid credentials or failed to initialize Supabase client.');
    } else {
      setNeedsConfig(false);
      setError(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not configured. Open settings below to add URL and Anon Key.');
      }

      // If user had existing email/password account, sign out first to ensure clean OAuth session
      await client.auth.signOut().catch(() => {});

      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.events',
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      
      onAuthSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Supabase is not configured properly.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });
        if (signUpErr) throw signUpErr;

        if (data.session) {
          setMessage('Account created and signed in successfully!');
          setTimeout(() => {
            onAuthSuccess();
            onClose();
          }, 1500);
        } else {
          setMessage('Registration successful! Please check your email for verification.');
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (signInErr) throw signInErr;

        setMessage('Signed in successfully!');
        setTimeout(() => {
          onAuthSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <style>{`
            input:-webkit-autofill,
            input:-webkit-autofill:hover, 
            input:-webkit-autofill:focus, 
            input:-webkit-autofill:active  {
              -webkit-box-shadow: 0 0 0 30px #080809 inset !important;
              -webkit-text-fill-color: white !important;
              transition: background-color 5000s ease-in-out 0s;
            }
          `}</style>

          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[310px] bg-[#0a0a0a] border border-white/[0.04] rounded-2xl p-6 shadow-2xl z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-zinc-400">
                {needsConfig ? 'backend config' : isSignUp ? 'register' : 'sign in'}
              </span>
              <button
                onClick={onClose}
                className="p-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Error or Success Alert */}
            {error && (
              <div className="mb-4 p-3 bg-red-950/10 border border-red-500/10 text-red-400 rounded-lg text-[10px] leading-normal font-mono">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 p-3 bg-emerald-950/10 border border-emerald-500/10 text-emerald-400 rounded-lg text-[10px] leading-normal font-mono flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            {needsConfig ? (
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="space-y-1">
                  <label className="sr-only" htmlFor="dbUrl">Supabase Project URL</label>
                  <input
                    id="dbUrl"
                    type="url"
                    required
                    placeholder="Supabase Project URL"
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    className="w-full bg-white/[0.02] hover:bg-white/[0.04] focus:bg-transparent border border-white/[0.06] focus:border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all duration-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="sr-only" htmlFor="anonKey">Supabase API Anon Key</label>
                  <input
                    id="anonKey"
                    type="password"
                    required
                    placeholder="Supabase Anon Key"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    className="w-full bg-white/[0.02] hover:bg-white/[0.04] focus:bg-transparent border border-white/[0.06] focus:border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all duration-200 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-white text-black hover:bg-zinc-200 transition-colors font-medium text-xs rounded-lg flex items-center justify-center mt-6 cursor-pointer"
                >
                  Connect Client
                </button>
              </form>
            ) : (
              <form onSubmit={handleAuth} className="space-y-4">
                {/* Google OAuth Login Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-2 px-3 bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all font-medium text-xs rounded-lg flex items-center justify-center gap-2 mb-3 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.3s.7 5.6 1.9 8l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z" />
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest my-2">
                  <div className="flex-1 h-px bg-white/5" />
                  <span>or email</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-1">
                  <label className="sr-only" htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/[0.02] hover:bg-white/[0.04] focus:bg-transparent border border-white/[0.06] focus:border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all duration-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="sr-only" htmlFor="password">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.02] hover:bg-white/[0.04] focus:bg-transparent border border-white/[0.06] focus:border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all duration-200 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5 stroke-[1.5]" /> : <Eye className="w-3.5 h-3.5 stroke-[1.5]" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-white text-black hover:bg-zinc-200 transition-colors font-medium text-xs rounded-lg flex items-center justify-center mt-6 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
                </button>

                <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.03] mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(prev => !prev);
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setNeedsConfig(true)}
                    className="text-[9px] text-zinc-650 hover:text-zinc-400 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Change Supabase config
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};


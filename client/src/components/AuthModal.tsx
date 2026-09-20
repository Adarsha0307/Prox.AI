import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_URL = 'http://localhost:3001';

export const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { setUser, setToken } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = isLogin ? { email, password } : { email, password, name };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.requiresVerification) {
        setIsVerifying(true);
        if (data.message) setSuccessMsg(data.message);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setToken(data.token);
      setUser(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setToken(data.token);
      setUser(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-[400px] overflow-hidden shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isVerifying ? 'Verify your email' : isLogin ? 'Welcome back' : 'Create an account'}
          </h2>

          {successMsg && (
            <div className="bg-emerald-900/50 text-emerald-200 text-sm p-3 rounded mb-4">
              {successMsg}
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 text-red-200 text-sm p-3 rounded mb-4">
              {error}
            </div>
          )}

          {isVerifying ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-neutral-400 mb-2">
                We've sent a 6-digit verification code to <strong>{email}</strong>. (Check terminal output for mock code)
              </p>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Verification Code</label>
                <input 
                  type="text" 
                  required
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                  className="w-full bg-neutral-800 text-white rounded p-2 text-sm border border-neutral-700 focus:border-emerald-500 focus:outline-none text-center tracking-widest text-lg"
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              <button 
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded text-sm font-medium transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button 
                type="button"
                onClick={() => setIsVerifying(false)}
                className="w-full text-neutral-400 hover:text-white p-2 text-sm transition-colors mt-2"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Name</label>
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-neutral-800 text-white rounded p-2 text-sm border border-neutral-700 focus:border-emerald-500 focus:outline-none"
                      placeholder="Your Name"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-neutral-800 text-white rounded p-2 text-sm border border-neutral-700 focus:border-emerald-500 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Password</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-neutral-800 text-white rounded p-2 text-sm border border-neutral-700 focus:border-emerald-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded text-sm font-medium transition-colors disabled:opacity-50 mt-2"
                >
                  {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-neutral-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </div>
            </>
          )}

          <div className="mt-8 text-center text-xs text-neutral-500">
            Copyright &copy; 2026 Adarsha B U. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

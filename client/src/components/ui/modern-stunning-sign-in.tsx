import React from "react";
import { Sparkles } from "lucide-react";

interface SignInProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  name: string;
  setName: (val: string) => void;
  verificationCode: string;
  setVerificationCode: (val: string) => void;
  isLogin: boolean;
  setIsLogin: (val: boolean) => void;
  isVerifying: boolean;
  setIsVerifying: (val: boolean) => void;
  error: string;
  successMsg: string;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onVerify: (e: React.FormEvent) => void;
}

export const ModernSignIn: React.FC<SignInProps> = ({
  email, setEmail, password, setPassword, name, setName,
  verificationCode, setVerificationCode,
  isLogin, setIsLogin, isVerifying, setIsVerifying,
  error, successMsg, loading, onSubmit, onVerify
}) => {
  return (
    <div className="min-h-[600px] flex flex-col items-center justify-center bg-[#121212] relative overflow-hidden w-full rounded-xl py-12">
      {/* Centered glass card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm shadow-2xl p-8 flex flex-col items-center border border-white/5">
        
        {/* Logo */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 mb-6 shadow-lg text-emerald-400">
          <Sparkles size={24} />
        </div>
        
        {/* Title */}
        <h2 className="text-2xl font-semibold text-white mb-6 text-center">
          {isVerifying ? 'Verify Email' : isLogin ? 'Prox' : 'Join Prox'}
        </h2>

        {successMsg && (
          <div className="bg-emerald-900/50 text-emerald-200 text-sm p-3 rounded-xl mb-4 w-full">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <div className="flex flex-col w-full gap-4">
          {isVerifying ? (
            <form onSubmit={onVerify} className="w-full flex flex-col gap-3">
              <p className="text-sm text-gray-400 mb-2 text-center">
                We've sent a 6-digit code to <strong>{email}</strong>. (Check terminal output)
              </p>
              <input
                placeholder="123456"
                type="text"
                value={verificationCode}
                maxLength={6}
                className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-400 text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onChange={(e) => setVerificationCode(e.target.value)}
                required
              />
              {error && <div className="text-sm text-red-400 text-left">{error}</div>}
              <button
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-3 rounded-full shadow transition mt-2 text-sm disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setIsVerifying(false)}
                className="w-full text-gray-400 hover:text-white font-medium px-5 py-2 rounded-full transition text-sm"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
                {!isLogin && (
                  <input
                    placeholder="Name"
                    type="text"
                    value={name}
                    className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                )}
                <input
                  placeholder="Email"
                  type="email"
                  value={email}
                  className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  placeholder="Password"
                  type="password"
                  value={password}
                  className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && <div className="text-sm text-red-400 text-left">{error}</div>}
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white/10 text-white font-medium px-5 py-3 rounded-full shadow hover:bg-white/20 transition mt-2 text-sm disabled:opacity-50 border border-white/5"
                >
                  {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
                </button>
              </form>
              
              <hr className="opacity-10 my-1 border-white" />
              
              <div>
                <button 
                  type="button"
                  onClick={() => alert("Google Sign-In coming soon!")}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#232526] to-[#2d2e30] rounded-full px-5 py-3 font-medium text-white shadow hover:brightness-110 transition mb-2 text-sm border border-white/5"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
                
                <div className="w-full text-center mt-4">
                  <span className="text-xs text-gray-400">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="underline text-white/80 hover:text-white ml-1"
                    >
                      {isLogin ? "Sign up, it's free!" : "Sign in instead"}
                    </button>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Social proof */}
      {!isVerifying && (
        <div className="relative z-10 mt-12 flex flex-col items-center text-center">
          <p className="text-gray-400 text-sm mb-3">
            Join <span className="font-medium text-white">thousands</span> of creators using Prox.
          </p>
          <div className="flex -space-x-3">
            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop" alt="user" className="w-8 h-8 rounded-full border-2 border-[#181824] object-cover" />
            <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=64&h=64&fit=crop" alt="user" className="w-8 h-8 rounded-full border-2 border-[#181824] object-cover" />
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop" alt="user" className="w-8 h-8 rounded-full border-2 border-[#181824] object-cover" />
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop" alt="user" className="w-8 h-8 rounded-full border-2 border-[#181824] object-cover" />
          </div>
        </div>
      )}
    </div>
  );
};

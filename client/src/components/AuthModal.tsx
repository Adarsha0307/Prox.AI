import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ModernSignIn } from './ui/modern-stunning-sign-in';
import { apiUrl } from '../utils/api';

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

      const res = await fetch(apiUrl(endpoint), {
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
      const res = await fetch(apiUrl('/auth/verify-email'), {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-[500px]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-neutral-400 hover:text-white bg-black/50 p-2 rounded-full backdrop-blur-sm transition shadow-lg border border-white/10"
        >
          <X size={20} />
        </button>
        <ModernSignIn
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          name={name}
          setName={setName}
          verificationCode={verificationCode}
          setVerificationCode={setVerificationCode}
          isLogin={isLogin}
          setIsLogin={setIsLogin}
          isVerifying={isVerifying}
          setIsVerifying={setIsVerifying}
          error={error}
          successMsg={successMsg}
          loading={loading}
          onSubmit={handleSubmit}
          onVerify={handleVerify}
        />
      </div>
    </div>
  );
};

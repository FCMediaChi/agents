import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTitle } from '../lib/useTitle';
import { Compass, Loader2, Mail } from 'lucide-react';

export default function RegisterPage() {
  useTitle('Register | Nuria AI');
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password);
      setRegistered(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[#C3E8FF] flex items-center justify-center">
              <Mail className="w-8 h-8 text-[#1A9EF2]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
          <p className="text-slate-500 text-sm">
            We sent a verification link to <strong>{email}</strong>. Click the link in the email to verify your account, then sign in.
          </p>
          <a href="/login" className="inline-block px-6 py-2.5 rounded-xl font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] text-sm">
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#1A9EF2] flex items-center justify-center">
              <Compass className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Get started with Nuria Website Blueprint free</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-200">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none transition-all text-sm" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none transition-all text-sm" placeholder="At least 6 characters" minLength={6} required />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white hover:opacity-90 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}Create Account
          </button>
          <p className="text-center text-xs text-slate-500">Already have an account? <a href="/login" className="text-[#1A9EF2] font-semibold hover:underline">Sign in</a></p>
        </form>
      </div>
    </div>
  );
}

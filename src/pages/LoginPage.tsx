import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { Compass, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail(null);
    setResendMessage('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/app';
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setUnverifiedEmail(err.body?.email || email);
        setError('Please verify your email. Check your inbox.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    setResendMessage('');
    try {
      const result = await api.auth.resendVerification(unverifiedEmail);
      setResendMessage(result.message);
    } catch (err: any) {
      setResendMessage(err.message || 'Failed to resend. Try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#1A9EF2] flex items-center justify-center">
              <Compass className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your Nuria Website Blueprint account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          {error && (
            <div className={`${unverifiedEmail ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'} text-sm p-3 rounded-xl border`}>
              {error}
              {unverifiedEmail && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="block mt-2 text-[#1A9EF2] font-semibold hover:underline text-xs disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend verification email'}
                </button>
              )}
              {resendMessage && (
                <p className="text-xs text-green-600 mt-1">{resendMessage}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none transition-all text-sm"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <a href="/forgot-password" className="text-xs text-[#1A9EF2] hover:underline font-medium">
                Forgot Password?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none transition-all text-sm"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white hover:opacity-90 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign In
          </button>

          <p className="text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <a href="/register" className="text-[#1A9EF2] font-semibold hover:underline">Create one</a>
          </p>
        </form>
      </div>
    </div>
  );
}

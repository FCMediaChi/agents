import { useState } from 'react';
import { api } from '../lib/api';
import { Compass, Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const r = await api.auth.forgotPassword(email);
      setSent(true);
      setMessage(r.message);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your email and we'll send you a reset link</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center space-y-3">
            <p className="text-sm text-slate-600">{message}</p>
            <a href="/login" className="inline-flex items-center gap-1 text-sm text-[#1A9EF2] font-semibold hover:underline">
              <ArrowLeft className="w-3 h-3" /> Back to Sign In
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-200">{error}</div>}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none transition-all text-sm" placeholder="you@example.com" required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white hover:opacity-90 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}Send Reset Link
            </button>
            <p className="text-center text-xs">
              <a href="/login" className="text-[#1A9EF2] font-semibold hover:underline">Back to Sign In</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

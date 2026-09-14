import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Compass, Loader2, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Invalid Link</h1>
          <p className="text-slate-500 text-sm">No reset token provided.</p>
          <Link to="/forgot-password" className="text-[#1A9EF2] font-semibold hover:underline text-sm">Request a new reset link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await api.auth.resetPassword(token, newPassword);
      setSuccess(true);
      setMessage(r.message);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Password Reset!</h1>
          <p className="text-slate-500 text-sm">{message}</p>
          <Link to="/login" className="inline-block px-6 py-2.5 rounded-xl font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] text-sm">Sign In</Link>
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
          <h1 className="text-2xl font-bold text-slate-900">Set New Password</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your new password below</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-200">{error}</div>}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none transition-all text-sm" placeholder="At least 6 characters" minLength={6} required />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl font-bold bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white hover:opacity-90 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTitle } from '../../lib/useTitle';
import { Loader2, Sparkles, Clock, CheckCircle } from 'lucide-react';
import { pipelineApi } from '../../lib/pipelineApi';

export default function PipelineRegister() {
  const navigate = useNavigate();
  useTitle('Nuria Client Pipeline | Nuria AI');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await pipelineApi.auth.register(email, password);
      navigate('/pipeline/onboarding');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/pipeline" className="inline-flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
            <Sparkles className="w-6 h-6 text-[#1A9EF2]" />
            Nuria Client Pipeline
          </Link>
          <p className="text-slate-500 mt-2">Start your 7-day free trial</p>
        </div>

        {/* Trial info card */}
        <div className="bg-gradient-to-r from-[#C3E8FF]/40 to-[#6DC7FF]/20 rounded-xl p-4 mb-6 border border-[#C3E8FF]/40">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-[#1A9EF2]" />
            <span className="font-semibold text-[#4551D3]">7-Day Free Trial</span>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" />
              Full access to all features
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" />
              No credit card required
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" />
              Cancel anytime
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2] transition-all"
                placeholder="you@agency.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2] transition-all"
                placeholder="Min. 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Start Free Trial
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            Already have an account?{' '}
            <Link to="/pipeline/login" className="text-[#1A9EF2] font-semibold hover:text-[#4551D3]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

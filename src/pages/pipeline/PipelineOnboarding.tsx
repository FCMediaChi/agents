import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Building2, Globe, Tag, Users, ArrowRight } from 'lucide-react';
import { pipelineApi } from '../../lib/pipelineApi';

export default function PipelineOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [agencyName, setAgencyName] = useState('');
  const [website, setWebsite] = useState('');
  const [niche, setNiche] = useState('');
  const [teamSize, setTeamSize] = useState('');

  useEffect(() => {
    // Check if user is authenticated and if agency already exists
    pipelineApi.auth.me()
      .then(({ user }) => {
        if (!user) {
          navigate('/pipeline/login');
          return;
        }
        return pipelineApi.agency.get();
      })
      .then((data) => {
        if (data?.agency) {
          navigate('/pipeline/dashboard');
        }
      })
      .catch(() => {
        // Will redirect to login on the next API call if not authenticated
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) {
      setError('Agency name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await pipelineApi.agency.create({
        agency_name: agencyName.trim(),
        website: website.trim() || undefined,
        niche: niche.trim() || undefined,
        team_size: teamSize || undefined,
      });
      navigate('/pipeline/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to save agency info');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A9EF2]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Tell us about your agency</h1>
          <p className="text-slate-500 mt-2">This helps us personalize your case studies and pitches.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="agencyName" className="block text-sm font-medium text-slate-700 mb-1.5">
                Agency Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="agencyName"
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2] transition-all"
                  placeholder="Your Agency, Inc."
                />
              </div>
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-slate-700 mb-1.5">
                Website
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2] transition-all"
                  placeholder="https://youragency.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="niche" className="block text-sm font-medium text-slate-700 mb-1.5">
                Niche / Specialty
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="niche"
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2] transition-all"
                  placeholder="e.g. Healthcare, E-commerce, SaaS"
                />
              </div>
            </div>

            <div>
              <label htmlFor="teamSize" className="block text-sm font-medium text-slate-700 mb-1.5">
                Team Size
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  id="teamSize"
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2] transition-all appearance-none bg-white"
                >
                  <option value="">Select...</option>
                  <option value="solo">Solo freelancer</option>
                  <option value="2-5">2-5 people</option>
                  <option value="6-15">6-15 people</option>
                  <option value="16-50">16-50 people</option>
                  <option value="50+">50+ people</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Continue to Dashboard
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          You can update this information later from your dashboard settings.
        </p>
      </div>
    </div>
  );
}

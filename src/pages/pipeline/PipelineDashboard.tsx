import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, FileText, Send, LayoutDashboard, LogOut, Plus, Clock, AlertTriangle } from 'lucide-react';
import { pipelineApi, type DashboardData } from '../../lib/pipelineApi';

type Tab = 'dashboard' | 'case-studies' | 'pitches';

export default function PipelineDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialActive, setTrialActive] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { user } = await pipelineApi.auth.me();
      setTrialEndsAt(user.trial_ends_at);
      setTrialActive(user.trial_active);
      const dashData = await pipelineApi.dashboard.get();
      setData(dashData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
      if (err.message?.includes('Trial expired') || err.message?.includes('403')) {
        setTrialActive(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    navigate('/pipeline');
  };

  const daysLeft = trialEndsAt && trialActive
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A9EF2]" />
      </div>
    );
  }

  // Trial expired state
  if (!trialActive && error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Trial Expired</h2>
          <p className="text-slate-500 mb-6">
            Your 7-day free trial has ended. Upgrade to a paid plan to continue using Nuria Client Pipeline.
          </p>
          <a
            href="/pipeline#pricing"
            className="inline-block px-6 py-2.5 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all shadow-md"
          >
            View Plans
          </a>
          <button onClick={handleLogout} className="block w-full mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-100">
          <Link to="/pipeline" className="text-lg font-bold bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
            Nuria Pipeline
          </Link>
          {data?.agency && (
            <p className="text-xs text-slate-400 mt-1 truncate">{data.agency.agency_name}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'case-studies' as Tab, label: 'Case Study Generator', icon: FileText },
            { id: 'pitches' as Tab, label: 'Cold Pitch Builder', icon: Send },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-[#C3E8FF]/40 text-[#1A9EF2]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'case-studies' && 'Case Study Generator'}
            {activeTab === 'pitches' && 'Cold Pitch Builder'}
          </h1>
          {trialActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C3E8FF]/40 text-sm text-[#4551D3] font-medium">
              <Clock className="w-4 h-4" />
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left in trial
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-6 hover:border-[#1A9EF2]/30 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#C3E8FF]/40 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#1A9EF2]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{data?.stats.case_studies ?? 0}</p>
                      <p className="text-xs text-slate-500">Case Studies</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('case-studies')}
                    className="text-sm text-[#1A9EF2] hover:text-[#4551D3] font-medium flex items-center gap-1"
                  >
                    Create New <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 hover:border-[#1A9EF2]/30 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#C3E8FF]/40 flex items-center justify-center">
                      <Send className="w-5 h-5 text-[#1A9EF2]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{data?.stats.pitches ?? 0}</p>
                      <p className="text-xs text-slate-500">Cold Pitches</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('pitches')}
                    className="text-sm text-[#1A9EF2] hover:text-[#4551D3] font-medium flex items-center gap-1"
                  >
                    Create New <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Recent Case Studies */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Case Studies</h3>
                {data?.recent_case_studies && data.recent_case_studies.length > 0 ? (
                  <div className="space-y-3">
                    {data.recent_case_studies.map((cs) => (
                      <div key={cs.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div>
                          <p className="font-medium text-slate-900">{cs.client_name}</p>
                          <p className="text-xs text-slate-500">{cs.industry || 'No industry'} &middot; {cs.status}</p>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(cs.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No case studies yet.</p>
                    <button
                      onClick={() => setActiveTab('case-studies')}
                      className="text-sm text-[#1A9EF2] font-medium mt-1"
                    >
                      Create your first case study
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Pitches */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Pitches</h3>
                {data?.recent_pitches && data.recent_pitches.length > 0 ? (
                  <div className="space-y-3">
                    {data.recent_pitches.map((pitch) => (
                      <div key={pitch.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div>
                          <p className="font-medium text-slate-900">{pitch.prospect_name}</p>
                          <p className="text-xs text-slate-500">{pitch.company_name || 'No company'} &middot; {pitch.status}</p>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(pitch.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pitches yet.</p>
                    <button
                      onClick={() => setActiveTab('pitches')}
                      className="text-sm text-[#1A9EF2] font-medium mt-1"
                    >
                      Create your first pitch
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Case Studies Tab (placeholder) */}
          {activeTab === 'case-studies' && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Case Study Generator</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                Turn client results into professional case studies. This feature is coming soon — check back shortly.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm font-medium">
                <Clock className="w-4 h-4" />
                Coming Soon
              </div>
            </div>
          )}

          {/* Pitches Tab (placeholder) */}
          {activeTab === 'pitches' && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Send className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cold Pitch Builder</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                Craft personalized outreach messages that convert. This feature is coming soon — check back shortly.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm font-medium">
                <Clock className="w-4 h-4" />
                Coming Soon
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

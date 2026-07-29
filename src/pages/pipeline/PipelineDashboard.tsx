import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTitle } from '../../lib/useTitle';
import { Loader2, FileText, Send, LayoutDashboard, LogOut, Plus, Clock, AlertTriangle, CalendarCheck } from 'lucide-react';
import { pipelineApi, type DashboardData } from '../../lib/pipelineApi';

type Tab = 'dashboard' | 'case-studies' | 'pitches';

export default function PipelineDashboard() {
  const navigate = useNavigate();
  useTitle('Nuria Client Pipeline | Nuria AI');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialActive, setTrialActive] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const { user } = await pipelineApi.auth.me();
      setTrialEndsAt(user.trial_ends_at);
      setTrialActive(user.trial_active);
      const dashData = await pipelineApi.dashboard.get();
      setData(dashData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
      if (err.message?.includes('Trial expired') || err.message?.includes('402')) setTrialActive(false);
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    navigate('/pipeline');
  };

  const daysLeft = trialEndsAt && trialActive
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#1A9EF2]" /></div>;
  }

  if (!trialActive && error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Trial Expired</h2>
          <p className="text-slate-500 mb-6">Your 7-day free trial has ended. Upgrade to a paid plan to continue using Nuria Client Pipeline.</p>
          <a href="/pipeline#pricing" className="inline-block px-6 py-2.5 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all shadow-md">View Plans</a>
          <button onClick={handleLogout} className="block w-full mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-100">
          <Link to="/pipeline" className="text-lg font-bold bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">Nuria Pipeline</Link>
          {data?.agency && <p className="text-xs text-slate-400 mt-1 truncate">{data.agency.agency_name}</p>}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'case-studies' as Tab, label: 'Case Study Generator', icon: FileText },
            { id: 'pitches' as Tab, label: 'Cold Pitch Builder', icon: Send },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === item.id ? 'bg-[#C3E8FF]/40 text-[#1A9EF2]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all"><LogOut className="w-4 h-4" />Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'case-studies' && 'Case Study Generator'}
            {activeTab === 'pitches' && 'Cold Pitch Builder'}
          </h1>
          {trialActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C3E8FF]/40 text-sm text-[#4551D3] font-medium">
              <Clock className="w-4 h-4" />{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left in trial
            </div>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Welcome */}
              {data?.agency && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-slate-900">Welcome back, {data.agency.agency_name}</h2>
                </div>
              )}

              {/* Stat Cards */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: 'Case Studies Created', value: data?.stats.case_studies ?? 0, icon: FileText },
                  { label: 'Pitches Generated', value: data?.stats.pitches ?? 0, icon: Send },
                  { label: 'Meetings Booked', value: data?.stats.meetings_booked ?? 0, icon: CalendarCheck },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 hover:border-[#1A9EF2]/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#C3E8FF]/40 flex items-center justify-center">
                        <stat.icon className="w-5 h-5 text-[#1A9EF2]" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                        <p className="text-xs text-slate-500">{stat.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="/pipeline/case-study" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all shadow-md">
                  <Plus className="w-4 h-4" /> Create Case Study
                </a>
                <a href="/pipeline/cold-pitch" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-[#1A9EF2] text-[#1A9EF2] font-semibold hover:bg-[#C3E8FF]/20 transition-all">
                  <Plus className="w-4 h-4" /> New Pitch
                </a>
              </div>

              {/* Recent Case Studies */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Case Studies</h3>
                {data?.recent_case_studies && data.recent_case_studies.length > 0 ? (
                  <div className="space-y-3">
                    {data.recent_case_studies.map((cs) => (
                      <div key={cs.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div><p className="font-medium text-slate-900">{cs.client_name}</p><p className="text-xs text-slate-500">{cs.status}</p></div>
                        <span className="text-xs text-slate-400">{new Date(cs.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No case studies yet. Create your first one.</p>
                    <a href="/pipeline/case-study" className="text-sm text-[#1A9EF2] font-medium mt-1 inline-block">Create a case study</a>
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
                        <div><p className="font-medium text-slate-900">{pitch.prospect_name}</p><p className="text-xs text-slate-500">{pitch.status}</p></div>
                        <span className="text-xs text-slate-400">{new Date(pitch.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pitches yet. Start prospecting.</p>
                    <a href="/pipeline/cold-pitch" className="text-sm text-[#1A9EF2] font-medium mt-1 inline-block">Create a new pitch</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Case Studies placeholder */}
          {activeTab === 'case-studies' && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Case Study Generator</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">Upload screenshots, input traffic/revenue data, link old site — AI generates a narrative case study.</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm font-medium"><Clock className="w-4 h-4" />Coming Soon</div>
            </div>
          )}

          {/* Pitches placeholder */}
          {activeTab === 'pitches' && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Send className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cold Pitch Builder</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">Enter prospect URL — AI analyzes speed/layout/SEO flaws and generates a custom teardown report with cold email script.</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm font-medium"><Clock className="w-4 h-4" />Coming Soon</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

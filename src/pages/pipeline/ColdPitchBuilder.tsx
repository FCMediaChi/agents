import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Mail, Copy, RefreshCw, Save, Plus, AlertTriangle, ChevronDown, ExternalLink, Check } from 'lucide-react';
import { pipelineApi, type PipelinePitch, type PitchFinding, type ColdEmailScript } from '../../lib/pipelineApi';

const SERVICES = ['Web Design', 'SEO', 'Performance Optimization', 'Full Redesign', 'Other'];
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  suggestion: 'bg-blue-100 text-blue-700 border-blue-200',
};
const SEVERITY_ICONS: Record<string, string> = { critical: '🔴', warning: '🟡', suggestion: '🔵' };

type Tab = 'teardown' | 'email';

export default function ColdPitchBuilder() {
  const [step, setStep] = useState<'create' | 'analyzing' | 'result'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pitch, setPitch] = useState<PipelinePitch | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('teardown');
  const [copied, setCopied] = useState(false);

  // Form
  const [prospectName, setProspectName] = useState('');
  const [prospectUrl, setProspectUrl] = useState('');
  const [service, setService] = useState(SERVICES[0]);

  const findings: PitchFinding[] = pitch?.audit_results?.findings || [];
  const email: ColdEmailScript | null = pitch?.cold_email || null;

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const suggestionCount = findings.filter(f => f.severity === 'suggestion').length;

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectName.trim()) { setError('Prospect name is required'); return; }
    if (!prospectUrl.trim()) { setError('Prospect URL is required'); return; }
    setLoading(true); setError('');

    try {
      const { pitch: created } = await pipelineApi.pitches.create({
        prospect_name: prospectName.trim(),
        prospect_url: prospectUrl.trim(),
        service,
      });
      setPitch(created);
      setStep('analyzing');

      const { pitch: analyzed } = await pipelineApi.pitches.analyze(created.id);
      setPitch(analyzed);
      setStep('result');
    } catch (err: any) { setError(err.message || 'Analysis failed'); setStep('create'); }
    finally { setLoading(false); }
  };

  const handleCopyEmail = () => {
    if (!email) return;
    const text = `Subject: ${email.subject}\n\n${email.body}\n\n---\n${email.signature}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!pitch) return;
    setLoading(true); setError('');
    try {
      const { pitch: analyzed } = await pipelineApi.pitches.analyze(pitch.id);
      setPitch(analyzed);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/pipeline/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1A9EF2] mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Cold Pitch Builder</h1>

        {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-6 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button></div>}

        {/* CREATE FORM */}
        {step === 'create' && (
          <form onSubmit={handleAnalyze} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Search className="w-5 h-5 text-[#1A9EF2]" />Prospect Information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prospect Name *</label>
                <input type="text" value={prospectName} onChange={e => setProspectName(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="e.g. Jane Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prospect Website URL *</label>
                <input type="url" value={prospectUrl} onChange={e => setProspectUrl(e.target.value)} required
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="https://their-site.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Service You're Pitching</label>
              <div className="relative">
                <select value={service} onChange={e => setService(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2] appearance-none bg-white">
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Analyze & Generate Pitch
            </button>
          </form>
        )}

        {/* ANALYZING */}
        {step === 'analyzing' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#1A9EF2] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Analyzing {prospectUrl.replace('https://', '')}</h2>
            <p className="text-slate-500">Running 5 analysis passes: speed, layout, SEO, conversion, and design...</p>
            <div className="mt-6 max-w-xs mx-auto">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1A9EF2] rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}

        {/* RESULT */}
        {step === 'result' && (
          <div className="space-y-6">
            {/* Action bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3">
              <button onClick={handleCopyEmail} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white font-medium hover:bg-[#4551D3] transition-all flex items-center gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Email'}
              </button>
              <button onClick={handleRegenerate} disabled={loading}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all flex items-center gap-2 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Regenerate
              </button>
              <button onClick={() => { setStep('create'); setPitch(null); }}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all flex items-center gap-2 ml-auto">
                <Plus className="w-4 h-4" /> New Pitch
              </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                <div className="text-xs text-slate-500">🔴 Critical</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
                <div className="text-xs text-slate-500">🟡 Warnings</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{suggestionCount}</div>
                <div className="text-xs text-slate-500">🔵 Suggestions</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                {[
                  { id: 'teardown' as Tab, label: `🔍 Website Teardown (${findings.length})` },
                  { id: 'email' as Tab, label: '✉️ Cold Email Script' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${activeTab === tab.id ? 'text-[#1A9EF2] border-b-2 border-[#1A9EF2] bg-[#C3E8FF]/10' : 'text-slate-500 hover:text-slate-700'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Teardown tab */}
              {activeTab === 'teardown' && (
                <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                  {findings.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No findings available.</p>
                    </div>
                  ) : (
                    findings.map((f, i) => (
                      <div key={i} className={`p-4 rounded-xl border ${SEVERITY_COLORS[f.severity] || 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-lg mt-0.5">{SEVERITY_ICONS[f.severity]}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</span>
                            </div>
                            <p className="font-medium text-slate-900 mb-1">{f.issue}</p>
                            <p className="text-xs text-slate-500 mb-2">⚠️ Why it matters: {f.why_matters}</p>
                            <p className="text-xs text-slate-600"><span className="font-medium">✅ Fix:</span> {f.fix}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Email tab */}
              {activeTab === 'email' && email && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Subject Line</label>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900">{email.subject}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email Body</label>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-line leading-relaxed font-mono">{email.body}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Signature</label>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-500 whitespace-pre-line">{email.signature}</div>
                  </div>
                </div>
              )}
              {activeTab === 'email' && !email && (
                <div className="p-6 text-center text-slate-400">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No email script available.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

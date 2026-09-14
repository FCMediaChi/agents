import { useState } from 'react';
import { AUDIT_PLANS } from '../../lib/pricing';
import { useTitle } from '../../lib/useTitle';
import { Globe, Search, AlertCircle, CheckCircle2, XCircle, Loader2, BarChart3, ExternalLink, ChevronDown } from 'lucide-react';

interface AuditCheck {
  check_name: string;
  label: string;
  passed: boolean;
  severity: string;
  detail: string | null;
  recommendation: string | null;
}

interface AuditDimension {
  dimension: string;
  label: string;
  icon: string;
  score: number;
  status: string;
  summary: string;
  checks: AuditCheck[];
}

interface AuditReport {
  id: string;
  target_url: string;
  overall_score: number;
  status: string;
  summary: string;
  error?: string;
  created_at: string;
  dimensions: AuditDimension[];
}

function LockedDimensionCard({ dim }: { dim: AuditDimension }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 opacity-75">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{dim.icon || '🔒'}</span>
          <div>
            <div className="font-bold text-slate-500">{dim.label}</div>
            <div className="text-xs text-slate-400">🔒 Locked — upgrade to access</div>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
          Premium
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
        <p className="text-xs text-slate-400">{dim.checks[0]?.recommendation || 'Upgrade to unlock this dimension.'}</p>
        <a href="#pricing" className="mt-2 inline-block text-xs font-semibold text-[#1A9EF2] hover:text-[#4551D3]">
          View Plans →
        </a>
      </div>
    </div>
  );
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#22c55e' : score >= 70 ? '#86efac' : score >= 50 ? '#eab308' : score >= 30 ? '#f97316' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xl font-extrabold">{score}</span>
      </div>
    </div>
  );
}

const DIMENSION_ICONS: Record<string, string> = {
  homepage: '🏠', mobile: '📱', branding: '🎨', navigation: '🧭',
  trust: '🛡️', conversion: '📈', accessibility: '♿',
};

function DimensionCard({ dim }: { dim: AuditDimension }) {
  const [expanded, setExpanded] = useState(false);
  const bgColor = dim.status === 'pass' ? 'bg-green-50 border-green-200' : dim.status === 'warn' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
  const scoreColor = dim.score >= 70 ? 'text-green-700' : dim.score >= 40 ? 'text-yellow-700' : 'text-red-700';
  return (
    <div className={`rounded-xl border p-4 ${bgColor}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{dim.icon || DIMENSION_ICONS[dim.dimension] || '📋'}</span>
          <div className="text-left">
            <div className="font-bold text-slate-900">{dim.label}</div>
            <div className="text-xs text-slate-500">{dim.summary}</div>
          </div>
        </div>
        <div className={`text-right font-extrabold text-lg ${scoreColor}`}>{dim.score}<span className="text-xs text-slate-400">/100</span></div>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          {dim.checks.map((check) => (
            <div key={check.check_name} className="flex items-start gap-2 text-sm">
              {check.passed ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className={`w-4 h-4 mt-0.5 shrink-0 ${check.severity === 'critical' ? 'text-red-500' : check.severity === 'warning' ? 'text-yellow-500' : 'text-slate-400'}`} />
              )}
              <div>
                <span className={`font-medium ${check.passed ? 'text-green-700' : 'text-slate-800'}`}>{check.label}</span>
                {check.detail && <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>}
                {!check.passed && check.recommendation && (
                  <p className="text-xs text-blue-600 mt-0.5">💡 {check.recommendation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  { icon: '🏠', title: 'Homepage Analysis', desc: 'Checks title tags, meta descriptions, H1 headings, content quality, and CTA clarity.' },
  { icon: '📱', title: 'Mobile Readiness', desc: 'Validates viewport config, tap targets, font sizing, and responsive images.' },
  { icon: '🎨', title: 'Branding Consistency', desc: 'Reviews logo usage, favicon presence, color scheme, fonts, and tagline clarity.' },
  { icon: '🧭', title: 'Navigation & UX', desc: 'Evaluates menu structure, link health, breadcrumbs, search functionality, and contact access.' },
  { icon: '🛡️', title: 'Trust & Credibility', desc: 'Checks SSL, privacy policy, terms, contact info, and social proof elements.' },
  { icon: '📈', title: 'Conversion Ready', desc: 'Analyzes CTAs, form quality, testimonials, and urgency/trust signals.' },
  { icon: '♿', title: 'Accessibility', desc: 'Audits alt text, color contrast, heading hierarchy, and form labels.' },
];

const FAQ_ITEMS = [
  { q: 'What does the audit check?', a: 'Nuria Website Audit analyzes up to 7 key dimensions: homepage quality, mobile readiness, branding consistency, navigation & UX, trust & credibility, conversion readiness, and accessibility compliance. Each dimension has 4-5 individual checks. Free audits cover the homepage dimension; full access requires an upgrade.' },
  { q: 'How long does an audit take?', a: 'Most audits complete within 30-60 seconds. The tool fetches and analyzes your website\'s HTML, CSS, and meta data to generate a comprehensive report.' },
  { q: 'Do I need to sign up?', a: 'Free homepage audits are available without an account. For full reports, history, and premium features, you can create a free account and upgrade to paid plans.' },
  { q: 'What do the scores mean?', a: 'Scores range from 0-100. A (90+): Excellent. B (70-89): Good. C (50-69): Average. D (30-49): Poor. F (below 30): Critical — needs immediate attention.' },
  { q: 'Can I audit my own site?', a: 'Yes! Enter any public URL. The tool works best on live, publicly accessible websites. Password-protected or local-only sites cannot be audited.' },
  { q: 'What\'s included in each plan?', a: 'Free: homepage-only audit. Single Use ($29): full 7-dimension audit for 1 website. Team ($49/mo or $470/yr): up to 10 websites, 5 user seats, full audits. Agency ($79/mo or $755/yr): unlimited websites, unlimited users, white-labeling, client management.' },
];

const PLANS = AUDIT_PLANS;

export default function AuditPage() {
  useTitle('Nuria Website Audit | Nuria AI');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<AuditReport | null>(null);
  const [polling, setPolling] = useState(false);
  const [showTool, setShowTool] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch('/api/audit/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to start audit'); setLoading(false); return; }
      setLoading(false); setPolling(true);
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/audit/reports/${data.report_id}/status`, { credentials: 'include' });
          const statusData = await statusRes.json();
          if (statusData.status === 'completed' || statusData.status === 'failed') {
            clearInterval(pollInterval); setPolling(false);
            const reportRes = await fetch(`/api/audit/reports/${data.report_id}`, { credentials: 'include' });
            const reportData = await reportRes.json();
            setReport(reportData);
          }
        } catch { clearInterval(pollInterval); setPolling(false); setError('Failed to check audit status'); }
      }, 2000);
    } catch { setLoading(false); setError('Network error. Please try again.'); }
  };

  const gradeColor = (score: number) =>
    score >= 90 ? 'text-green-600' : score >= 70 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : score >= 30 ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#1A9EF2] via-[#4551D3] to-[#1A9EF2] text-white">
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 text-white text-sm font-semibold mb-6 backdrop-blur-sm">
            <BarChart3 className="w-4 h-4" />
            Nuria Website Audit
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Audit Your Website <br className="hidden md:block" />in <span className="text-[#C3E8FF]">60 Seconds</span>
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            Get a plain-English report across 7 quality dimensions — homepage, mobile, branding,
            navigation, trust, conversion, and accessibility. Free audits cover the homepage dimension;
            full 7-dimension reports available on paid plans.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => setShowTool(true)} className="px-8 py-3.5 rounded-xl font-bold bg-white text-[#1A9EF2] hover:bg-[#C3E8FF] transition-all shadow-lg text-base flex items-center gap-2">
              <Search className="w-5 h-5" /> Try It Free
            </button>
            <a href="#features" className="px-8 py-3.5 rounded-xl font-bold text-white border-2 border-white/30 hover:bg-white/10 transition-all text-base">
              See What We Check
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900">7 Quality Dimensions</h2>
          <p className="text-slate-600 mt-2 max-w-xl mx-auto">Every audit checks your website against these essential criteria</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-[#C3E8FF] transition-all">
              <span className="text-2xl mb-3 block">{f.icon}</span>
              <h3 className="font-bold text-slate-900 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900">How It Works</h2>
            <p className="text-slate-600 mt-2">Three simple steps to a complete website audit</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Enter URL', desc: 'Paste any public website URL into the audit tool', icon: Globe },
              { step: '2', title: 'We Analyze', desc: 'Our engine checks 30+ criteria across 7 dimensions', icon: BarChart3 },
              { step: '3', title: 'Get Report', desc: 'Receive a plain-English report with scores & fixes', icon: CheckCircle2 },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#C3E8FF] flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-[#1A9EF2]" />
                </div>
                <div className="text-xs font-bold text-[#1A9EF2] mb-1">STEP {item.step}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900">Simple Pricing</h2>
          <p className="text-slate-600 mt-2">Start with a free homepage audit, upgrade when you need more</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`rounded-2xl border-2 p-6 text-center flex flex-col ${plan.featured ? 'border-[#1A9EF2] bg-white shadow-lg shadow-[#1A9EF2]/10 relative' : 'border-slate-200 bg-white'}`}>
              {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#1A9EF2] text-white text-xs font-bold rounded-full whitespace-nowrap">Most Popular</div>}
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <div className="text-3xl font-extrabold text-slate-900 my-3">{plan.price}</div>
              <p className="text-xs text-slate-500 mb-4">{plan.desc}</p>
              <ul className="text-xs text-slate-600 space-y-2 mb-6 text-left flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />{f}</li>
                ))}
              </ul>
              <a href={plan.href} target={plan.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                className={`block w-full py-2.5 rounded-xl font-bold text-sm transition-all ${plan.featured ? 'bg-[#1A9EF2] hover:bg-[#4551D3] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                {plan.cta}
              </a>
              {(plan as any).secondaryCta && (
                <a href={(plan as any).secondaryHref} target="_blank" rel="noopener noreferrer"
                  className="block w-full mt-2 py-2 rounded-lg font-medium text-xs text-[#1A9EF2] hover:text-[#4551D3] border border-[#C3E8FF] hover:border-[#1A9EF2] transition-all">
                  {(plan as any).secondaryCta}
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left font-semibold text-slate-900 hover:bg-slate-50 transition-all text-sm">
                  {item.q}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`} />
                </button>
                {faqOpen === i && <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">{item.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Audit Tool */}
      <section id="audit-form" className="max-w-4xl mx-auto px-4 py-12">
        {!showTool ? (
          <div className="bg-gradient-to-br from-[#1A9EF2] to-[#4551D3] rounded-3xl p-10 text-center text-white">
            <h2 className="text-2xl font-extrabold mb-3">Ready to Audit Your Website?</h2>
            <p className="text-white/80 mb-6 max-w-lg mx-auto">Get your free audit report in under a minute. No signup required for the first audit.</p>
            <button onClick={() => setShowTool(true)} className="px-8 py-3 rounded-xl font-bold bg-white text-[#1A9EF2] hover:bg-[#C3E8FF] transition-all shadow-lg text-base">
              <Search className="w-4 h-4 inline mr-2" /> Get Started
            </button>
          </div>
        ) : (
          <>
            {/* URL Input */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-extrabold text-slate-900">Enter Your Website URL</h2>
                <p className="text-sm text-slate-500">Free tier analyzes the homepage. Upgrade for full 7-dimension reports.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter a website URL (e.g., example.com)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
                    disabled={loading || polling} />
                </div>
                <button type="submit" disabled={loading || polling || !url.trim()}
                  className="px-6 py-3 rounded-xl font-bold bg-[#1A9EF2] hover:bg-[#4551D3] disabled:bg-slate-300 text-white transition-all text-sm flex items-center gap-2">
                  {loading || polling ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Search className="w-4 h-4" /> Run Audit</>}
                </button>
              </div>
              {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
            </form>

            {/* Polling state */}
            {polling && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A9EF2] mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Analyzing your website...</p>
                <p className="text-slate-400 text-sm mt-1">Checking meta tags, mobile friendliness, accessibility, and more</p>
              </div>
            )}

            {/* Report */}
            {report && report.status === 'completed' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="relative"><ScoreRing score={report.overall_score} size={100} /></div>
                    <div className="text-left">
                      <div className="text-3xl font-extrabold text-slate-900">{report.overall_score}<span className="text-lg text-slate-400">/100</span></div>
                      <div className={`text-lg font-semibold ${gradeColor(report.overall_score)}`}>
                        {report.overall_score >= 90 ? 'Excellent' : report.overall_score >= 70 ? 'Good' : report.overall_score >= 50 ? 'Average' : report.overall_score >= 30 ? 'Poor' : 'Critical'}
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm max-w-xl mx-auto">{report.summary}</p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <ExternalLink className="w-3 h-3" />{report.target_url}<span className="mx-1">·</span>{new Date(report.created_at).toLocaleDateString()}
                  </div>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Dimension Breakdown</h2>
                <div className="grid gap-3">
                  {report.dimensions.map((dim) => (
                    dim.checks.length === 1 && dim.checks[0].check_name.endsWith('_locked')
                      ? <LockedDimensionCard key={dim.dimension} dim={dim} />
                      : <DimensionCard key={dim.dimension} dim={dim} />
                  ))}
                </div>
                <div className="text-center">
                  <button onClick={() => { setReport(null); setUrl(''); }} className="text-sm text-[#1A9EF2] hover:text-[#4551D3] font-medium">Run another audit →</button>
                </div>
              </div>
            )}

            {report && report.status === 'failed' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-red-800 mb-2">Audit Failed</h2>
                <p className="text-red-600 text-sm">{report.error || 'Could not analyze this website.'}</p>
                <button onClick={() => { setReport(null); setUrl(''); }} className="mt-4 text-sm text-red-700 font-medium hover:underline">Try again</button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-slate-400">
          Nuria Website Audit by First Creation Media
        </div>
      </footer>
    </div>
  );
}

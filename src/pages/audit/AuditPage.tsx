import { useState } from 'react';
import { Globe, Search, AlertCircle, CheckCircle2, XCircle, Loader2, BarChart3, ExternalLink } from 'lucide-react';

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

export default function AuditPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<AuditReport | null>(null);
  const [polling, setPolling] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setReport(null);
    setLoading(true);

    try {
      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start audit');
        setLoading(false);
        return;
      }

      setLoading(false);
      setPolling(true);

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/audit/reports/${data.report_id}/status`, { credentials: 'include' });
          const statusData = await statusRes.json();

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            clearInterval(pollInterval);
            setPolling(false);

            // Fetch full report
            const reportRes = await fetch(`/api/audit/reports/${data.report_id}`, { credentials: 'include' });
            const reportData = await reportRes.json();
            setReport(reportData);
          }
        } catch {
          clearInterval(pollInterval);
          setPolling(false);
          setError('Failed to check audit status');
        }
      }, 2000);
    } catch {
      setLoading(false);
      setError('Network error. Please try again.');
    }
  };

  const gradeColor = (score: number) =>
    score >= 90 ? 'text-green-600' : score >= 70 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : score >= 30 ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C3E8FF]/60 text-[#4551D3] text-sm font-semibold mb-4">
            <BarChart3 className="w-4 h-4" />
            TheBlueprint Audit
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Website Audit Tool</h1>
          <p className="text-slate-600 mt-2">Enter any URL to get a plain-English audit across 7 quality dimensions</p>
        </div>

        {/* URL Input */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a website URL (e.g., example.com)"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
                disabled={loading || polling}
              />
            </div>
            <button
              type="submit"
              disabled={loading || polling || !url.trim()}
              className="px-6 py-3 rounded-xl font-bold bg-[#1A9EF2] hover:bg-[#4551D3] disabled:bg-slate-300 text-white transition-all text-sm flex items-center gap-2"
            >
              {loading || polling ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Search className="w-4 h-4" /> Run Audit</>
              )}
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

        {/* Report Results */}
        {report && report.status === 'completed' && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="relative">
                  <ScoreRing score={report.overall_score} size={100} />
                </div>
                <div className="text-left">
                  <div className="text-3xl font-extrabold text-slate-900">{report.overall_score}<span className="text-lg text-slate-400">/100</span></div>
                  <div className={`text-lg font-semibold ${gradeColor(report.overall_score)}`}>
                    {report.overall_score >= 90 ? 'Excellent' : report.overall_score >= 70 ? 'Good' : report.overall_score >= 50 ? 'Average' : report.overall_score >= 30 ? 'Poor' : 'Critical'}
                  </div>
                </div>
              </div>
              <p className="text-slate-600 text-sm max-w-xl mx-auto">{report.summary}</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                <ExternalLink className="w-3 h-3" />
                {report.target_url}
                <span className="mx-1">·</span>
                {new Date(report.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Dimension Cards */}
            <h2 className="text-lg font-bold text-slate-900">Dimension Breakdown</h2>
            <div className="grid gap-3">
              {report.dimensions.map((dim) => (
                <DimensionCard key={dim.dimension} dim={dim} />
              ))}
            </div>

            <div className="text-center">
              <button onClick={() => { setReport(null); setUrl(''); }}
                className="text-sm text-[#1A9EF2] hover:text-[#4551D3] font-medium">
                Run another audit →
              </button>
            </div>
          </div>
        )}

        {/* Failed report */}
        {report && report.status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-red-800 mb-2">Audit Failed</h2>
            <p className="text-red-600 text-sm">{report.error || 'Could not analyze this website. Check the URL and try again.'}</p>
            <button onClick={() => { setReport(null); setUrl(''); }}
              className="mt-4 text-sm text-red-700 font-medium hover:underline">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTitle } from '../../lib/useTitle';
import { FileText, Loader2, Check, ArrowLeft, Plus, Trash2, Edit3, Save, Sparkles, TrendingUp } from 'lucide-react';
import { pipelineApi, type PipelineCaseStudy } from '../../lib/pipelineApi';

type Step = 'create' | 'generating' | 'result';

export default function PipelineCaseStudyPage() {
  const [step, setStep] = useState<Step>('create');
  useTitle('Nuria Client Pipeline | Nuria AI');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [caseStudy, setCaseStudy] = useState<PipelineCaseStudy | null>(null);

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientUrl, setClientUrl] = useState('');
  const [oldSiteUrl, setOldSiteUrl] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [screenshotInput, setScreenshotInput] = useState('');

  // Traffic data
  const [monthlyVisitorsBefore, setMonthlyVisitorsBefore] = useState('');
  const [monthlyVisitorsAfter, setMonthlyVisitorsAfter] = useState('');
  const [bounceRateBefore, setBounceRateBefore] = useState('');
  const [bounceRateAfter, setBounceRateAfter] = useState('');
  const [avgSessionBefore, setAvgSessionBefore] = useState('');
  const [avgSessionAfter, setAvgSessionAfter] = useState('');

  // Revenue data
  const [monthlyRevenueBefore, setMonthlyRevenueBefore] = useState('');
  const [monthlyRevenueAfter, setMonthlyRevenueAfter] = useState('');
  const [conversionRateBefore, setConversionRateBefore] = useState('');
  const [conversionRateAfter, setConversionRateAfter] = useState('');
  const [leadGrowthBefore, setLeadGrowthBefore] = useState('');
  const [leadGrowthAfter, setLeadGrowthAfter] = useState('');

  // Editing result
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const addScreenshot = () => {
    const url = screenshotInput.trim();
    if (url && !screenshots.includes(url) && screenshots.length < 5) {
      setScreenshots([...screenshots, url]);
      setScreenshotInput('');
    }
  };

  const removeScreenshot = (idx: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) { setError('Client name is required'); return; }
    setLoading(true); setError('');
    try {
      const traffic = {
        monthly_visitors_before: monthlyVisitorsBefore ? Number(monthlyVisitorsBefore) : undefined,
        monthly_visitors_after: monthlyVisitorsAfter ? Number(monthlyVisitorsAfter) : undefined,
        bounce_rate_before: bounceRateBefore ? Number(bounceRateBefore) : undefined,
        bounce_rate_after: bounceRateAfter ? Number(bounceRateAfter) : undefined,
        avg_session_before: avgSessionBefore ? Number(avgSessionBefore) : undefined,
        avg_session_after: avgSessionAfter ? Number(avgSessionAfter) : undefined,
      };
      const revenue = {
        monthly_revenue_before: monthlyRevenueBefore ? Number(monthlyRevenueBefore) : undefined,
        monthly_revenue_after: monthlyRevenueAfter ? Number(monthlyRevenueAfter) : undefined,
        conversion_rate_before: conversionRateBefore ? Number(conversionRateBefore) : undefined,
        conversion_rate_after: conversionRateAfter ? Number(conversionRateAfter) : undefined,
        lead_growth_before: leadGrowthBefore ? Number(leadGrowthBefore) : undefined,
        lead_growth_after: leadGrowthAfter ? Number(leadGrowthAfter) : undefined,
      };
      const { case_study } = await pipelineApi.caseStudies.create({
        client_name: clientName.trim(),
        client_url: clientUrl.trim() || undefined,
        old_site_url: oldSiteUrl.trim() || undefined,
        traffic_data: Object.values(traffic).some(v => v !== undefined) ? traffic : undefined,
        revenue_data: Object.values(revenue).some(v => v !== undefined) ? revenue : undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      });
      setCaseStudy(case_study);
      setStep('generating');
      // Trigger generation immediately
      setLoading(true);
      try {
        const { case_study: generated } = await pipelineApi.caseStudies.generate(case_study.id);
        setCaseStudy(generated);
        setStep('result');
      } catch (err: any) {
        setError(err.message || 'Generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create case study');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = async () => {
    if (!caseStudy || !editingField || !caseStudy.generated_content) return;
    const updated = { ...caseStudy.generated_content, [editingField]: editValue };
    try {
      const { case_study } = await pipelineApi.caseStudies.update(caseStudy.id, { generated_content: updated });
      setCaseStudy(case_study);
      setEditingField(null);
    } catch (err: any) { setError(err.message); }
  };

  const content = caseStudy?.generated_content;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back nav */}
        <Link to="/pipeline/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1A9EF2] mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-8">Case Study Generator</h1>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-6">{error}</div>
        )}

        {/* Step: Create */}
        {step === 'create' && (
          <form onSubmit={handleCreate} className="space-y-8">
            {/* Client Info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-[#1A9EF2]" />Client Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Name *</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} required
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Website URL</label>
                  <input type="url" value={clientUrl} onChange={e => setClientUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="https://new-site.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Old Site URL (for audit)</label>
                <input type="url" value={oldSiteUrl} onChange={e => setOldSiteUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="https://old-site.com" />
                <p className="text-xs text-slate-400 mt-1">We'll run a light audit on this URL to identify issues for the case study.</p>
              </div>
            </div>

            {/* Screenshots */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Screenshots <span className="text-sm font-normal text-slate-400">(up to 5)</span></h2>
              <div className="flex gap-2">
                <input type="url" value={screenshotInput} onChange={e => setScreenshotInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addScreenshot())}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="Paste image URL..." />
                <button type="button" onClick={addScreenshot} disabled={screenshots.length >= 5 || !screenshotInput.trim()}
                  className="px-4 py-2.5 rounded-lg bg-[#1A9EF2] text-white font-medium hover:bg-[#4551D3] disabled:opacity-40 transition-all"><Plus className="w-4 h-4" /></button>
              </div>
              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {screenshots.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt={`Screenshot ${i+1}`} className="w-24 h-16 object-cover rounded-lg border border-slate-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <button type="button" onClick={() => removeScreenshot(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Traffic Data */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#1A9EF2]" />Traffic Data (Before & After)</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  ['Monthly Visitors', monthlyVisitorsBefore, setMonthlyVisitorsBefore, monthlyVisitorsAfter, setMonthlyVisitorsAfter],
                  ['Bounce Rate (%)', bounceRateBefore, setBounceRateBefore, bounceRateAfter, setBounceRateAfter],
                  ['Avg Session (sec)', avgSessionBefore, setAvgSessionBefore, avgSessionAfter, setAvgSessionAfter],
                ].map(([label, before, setBefore, after, setAfter]: any) => (
                  <div key={label} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={before} onChange={(e: any) => setBefore(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30" placeholder="Before" />
                      <input type="number" value={after} onChange={(e: any) => setAfter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30" placeholder="After" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Data */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Revenue Data (Before & After)</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  ['Monthly Revenue ($)', monthlyRevenueBefore, setMonthlyRevenueBefore, monthlyRevenueAfter, setMonthlyRevenueAfter],
                  ['Conversion Rate (%)', conversionRateBefore, setConversionRateBefore, conversionRateAfter, setConversionRateAfter],
                  ['Lead Growth', leadGrowthBefore, setLeadGrowthBefore, leadGrowthAfter, setLeadGrowthAfter],
                ].map(([label, before, setBefore, after, setAfter]: any) => (
                  <div key={label} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={before} onChange={(e: any) => setBefore(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30" placeholder="Before" />
                      <input type="number" value={after} onChange={(e: any) => setAfter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30" placeholder="After" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Generate Case Study
            </button>
          </form>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#1A9EF2] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Generating Case Study</h2>
            <p className="text-slate-500">
              {oldSiteUrl ? `Analyzing ${oldSiteUrl.replace('https://', '')} and crafting your narrative...` : 'Crafting your case study narrative...'}
            </p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && content && (
          <div className="space-y-6">
            {/* Metrics Cards */}
            {content.metrics && content.metrics.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Key Results</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {content.metrics.map((m, i) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-900">{m.after}</span>
                        {m.change !== 'N/A' && (
                          <span className={`text-sm font-semibold ${m.positive ? 'text-green-600' : 'text-red-500'}`}>
                            {m.change}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">from {m.before}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Narrative Title */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              {editingField === 'narrative_title' ? (
                <div className="flex gap-2">
                  <input value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-xl font-bold" />
                  <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white"><Save className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-xl font-bold text-slate-900">{content.narrative_title}</h2>
                  <button onClick={() => startEditing('narrative_title', content.narrative_title)} className="text-slate-400 hover:text-[#1A9EF2] flex-shrink-0"><Edit3 className="w-4 h-4" /></button>
                </div>
              )}
            </div>

            {/* Executive Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">Executive Summary</h3>
                {editingField !== 'executive_summary' && <button onClick={() => startEditing('executive_summary', content.executive_summary)} className="text-slate-400 hover:text-[#1A9EF2]"><Edit3 className="w-4 h-4" /></button>}
              </div>
              {editingField === 'executive_summary' ? (
                <div className="space-y-2">
                  <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm" />
                  <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white text-sm"><Save className="w-4 h-4 inline mr-1" />Save</button>
                </div>
              ) : (
                <p className="text-slate-600 text-sm leading-relaxed">{content.executive_summary}</p>
              )}
            </div>

            {/* Problem */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">🔴 The Problem</h3>
                {editingField !== 'problem' && <button onClick={() => startEditing('problem', content.problem)} className="text-slate-400 hover:text-[#1A9EF2]"><Edit3 className="w-4 h-4" /></button>}
              </div>
              {editingField === 'problem' ? (
                <div className="space-y-2">
                  <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm font-mono" />
                  <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white text-sm"><Save className="w-4 h-4 inline mr-1" />Save</button>
                </div>
              ) : (
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{content.problem}</div>
              )}
            </div>

            {/* Solution */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">🟡 The Solution</h3>
                {editingField !== 'solution' && <button onClick={() => startEditing('solution', content.solution)} className="text-slate-400 hover:text-[#1A9EF2]"><Edit3 className="w-4 h-4" /></button>}
              </div>
              {editingField === 'solution' ? (
                <div className="space-y-2">
                  <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm font-mono" />
                  <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white text-sm"><Save className="w-4 h-4 inline mr-1" />Save</button>
                </div>
              ) : (
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{content.solution}</div>
              )}
            </div>

            {/* Results */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900">🟢 The Results</h3>
                {editingField !== 'results' && <button onClick={() => startEditing('results', content.results)} className="text-slate-400 hover:text-[#1A9EF2]"><Edit3 className="w-4 h-4" /></button>}
              </div>
              {editingField === 'results' ? (
                <div className="space-y-2">
                  <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm font-mono" />
                  <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white text-sm"><Save className="w-4 h-4 inline mr-1" />Save</button>
                </div>
              ) : (
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{content.results}</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { setStep('create'); setCaseStudy(null); }}
                className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:border-[#1A9EF2] hover:text-[#1A9EF2] transition-all flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Another
              </button>
              <button onClick={() => { if (content) { navigator.clipboard.writeText(`# ${content.narrative_title}\n\n## Executive Summary\n${content.executive_summary}\n\n## Problem\n${content.problem}\n\n## Solution\n${content.solution}\n\n## Results\n${content.results}`); alert('Copied to clipboard!'); }}}
                className="px-6 py-2.5 rounded-xl bg-[#1A9EF2] text-white font-semibold hover:bg-[#4551D3] transition-all shadow-md flex items-center gap-2">
                <Check className="w-4 h-4" /> Copy to Clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Loader2, Plus, Trash2, Edit3, Save, Sparkles,
  ArrowLeft, Upload, Check, Copy, FileDown, Quote, X
} from 'lucide-react';
import { pipelineApi, type PipelineCaseStudy, type GeneratedCaseStudy } from '../../lib/pipelineApi';

export default function CaseStudyGenerator() {
  const [step, setStep] = useState<'create' | 'generating' | 'result'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [caseStudy, setCaseStudy] = useState<PipelineCaseStudy | null>(null);

  // Form
  const [clientName, setClientName] = useState('');
  const [clientUrl, setClientUrl] = useState('');
  const [oldSiteUrl, setOldSiteUrl] = useState('');
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [monthlyVisitors, setMonthlyVisitors] = useState('');
  const [bounceRate, setBounceRate] = useState('');
  const [avgSession, setAvgSession] = useState('');
  const [monthlyRevenue, setMonthlyRevenue] = useState('');
  const [conversionRate, setConversionRate] = useState('');
  const [leadGrowth, setLeadGrowth] = useState('');

  // Editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Testimonial
  const [testimonialText, setTestimonialText] = useState('');
  const [testimonialAuthor, setTestimonialAuthor] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // File handling
  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).slice(0, 5 - screenshotFiles.length);
    if (newFiles.length === 0) return;
    setScreenshotFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = (e) => setScreenshotPreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }, [screenshotFiles.length]);

  const removeScreenshot = (idx: number) => {
    setScreenshotFiles(prev => prev.filter((_, i) => i !== idx));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) { setError('Client name is required'); return; }
    setLoading(true); setError('');

    try {
      const formData = new FormData();
      formData.append('client_name', clientName.trim());
      if (clientUrl.trim()) formData.append('client_url', clientUrl.trim());
      if (oldSiteUrl.trim()) formData.append('old_site_url', oldSiteUrl.trim());
      screenshotFiles.forEach(f => formData.append('screenshots', f));

      const traffic: any = {};
      if (monthlyVisitors) traffic.monthly_visitors = Number(monthlyVisitors);
      if (bounceRate) traffic.bounce_rate = Number(bounceRate);
      if (avgSession) traffic.avg_session_duration = Number(avgSession);
      if (Object.keys(traffic).length > 0) formData.append('traffic_data', JSON.stringify(traffic));

      const revenue: any = {};
      if (monthlyRevenue) revenue.monthly_revenue = Number(monthlyRevenue);
      if (conversionRate) revenue.conversion_rate = Number(conversionRate);
      if (leadGrowth) revenue.lead_growth = Number(leadGrowth);
      if (Object.keys(revenue).length > 0) formData.append('revenue_data', JSON.stringify(revenue));

      const { case_study } = await pipelineApi.caseStudies.create(formData);
      setCaseStudy(case_study);
      setStep('generating');
      setLoading(true);

      try {
        const { case_study: generated } = await pipelineApi.caseStudies.generate(case_study.id);
        setCaseStudy(generated);
        setStep('result');
      } catch (err: any) { setError(err.message || 'Generation failed'); setStep('create'); }
    } catch (err: any) { setError(err.message || 'Failed'); }
    finally { setLoading(false); }
  };

  // Inline editing
  const startEditing = (field: string, value: string) => { setEditingField(field); setEditValue(value); };
  const saveEdit = async () => {
    if (!caseStudy || !editingField || !caseStudy.generated_content) return;
    const updated = { ...caseStudy.generated_content, [editingField]: editValue };
    try {
      const { case_study } = await pipelineApi.caseStudies.update(caseStudy.id, { generated_content: updated });
      setCaseStudy(case_study);
      setEditingField(null);
    } catch (err: any) { setError(err.message); }
  };

  // Copy
  const handleCopy = () => {
    if (!content) return;
    const text = `# ${content.narrative_title}\n\n## Executive Summary\n${content.executive_summary}\n\n## The Problem\n${content.problem}\n\n## Our Solution\n${content.solution}\n\n## The Results\n${content.results}\n\n## Client Testimonial\n${testimonialText ? `"${testimonialText}" — ${testimonialAuthor || clientName}` : '_Add your client testimonial here_'}`;
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // PDF export
  const handleExportPDF = () => {
    window.print();
  };

  const content = caseStudy?.generated_content;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/pipeline/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1A9EF2] mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Case Study Generator</h1>

        {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-6 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}

        {/* CREATE FORM */}
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
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="https://acmecorp.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Old Website URL (for audit)</label>
                <input type="url" value={oldSiteUrl} onChange={e => setOldSiteUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 focus:border-[#1A9EF2]" placeholder="https://old-acmecorp.com" />
                <p className="text-xs text-slate-400 mt-1">We'll run a comprehensive audit on this URL to identify issues.</p>
              </div>
            </div>

            {/* Screenshots */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Screenshots <span className="text-sm font-normal text-slate-400">(up to 5 images)</span></h2>
              <div
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-[#1A9EF2] bg-[#C3E8FF]/20' : 'border-slate-200 hover:border-[#1A9EF2]/50 hover:bg-slate-50'}`}>
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Drag & drop images here, or <span className="text-[#1A9EF2] font-medium">click to browse</span></p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF up to 10MB each</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
              </div>
              {screenshotPreviews.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {screenshotPreviews.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt={`Screenshot ${i+1}`} className="w-28 h-20 object-cover rounded-lg border border-slate-200" />
                      <button type="button" onClick={() => removeScreenshot(i)}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Traffic Data */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Traffic Data</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  ['Monthly Visitors', monthlyVisitors, setMonthlyVisitors, 'number'],
                  ['Bounce Rate (%)', bounceRate, setBounceRate, 'number'],
                  ['Avg Session Duration (sec)', avgSession, setAvgSession, 'number'],
                ].map(([label, val, setter]: any) => (
                  <div key={label}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    <input type="number" value={val} onChange={e => setter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Data */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Revenue Data</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  ['Monthly Revenue ($)', monthlyRevenue, setMonthlyRevenue],
                  ['Conversion Rate (%)', conversionRate, setConversionRate],
                  ['Lead Growth (%)', leadGrowth, setLeadGrowth],
                ].map(([label, val, setter]: any) => (
                  <div key={label}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    <input type="number" value={val} onChange={e => setter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30" placeholder="0" />
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

        {/* GENERATING */}
        {step === 'generating' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#1A9EF2] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Generating Case Study</h2>
            <p className="text-slate-500">Running audit on {oldSiteUrl || 'the old site'} and crafting your narrative...</p>
          </div>
        )}

        {/* RESULT */}
        {step === 'result' && content && (
          <div ref={resultRef} className="space-y-8 print:space-y-6">
            {/* Action bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 print:hidden">
              <button onClick={handleCopy} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all flex items-center gap-2"><Copy className="w-4 h-4" /> Copy to Clipboard</button>
              <button onClick={handleExportPDF} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all flex items-center gap-2"><FileDown className="w-4 h-4" /> Export as PDF</button>
              <button onClick={() => { setStep('create'); setCaseStudy(null); setScreenshotFiles([]); setScreenshotPreviews([]); }}
                className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white font-medium hover:bg-[#4551D3] transition-all flex items-center gap-2 ml-auto"><Plus className="w-4 h-4" /> New Case Study</button>
            </div>

            {/* Title */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 print:p-6">
              {editingField === 'narrative_title' ? (
                <div className="flex gap-2">
                  <input value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-2xl font-bold" />
                  <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white"><Save className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{content.narrative_title}</h1>
                  <button onClick={() => startEditing('narrative_title', content.narrative_title)} className="text-slate-400 hover:text-[#1A9EF2] print:hidden"><Edit3 className="w-4 h-4" /></button>
                </div>
              )}
            </div>

            {/* Executive Summary */}
            <SectionCard title="Executive Summary" field="executive_summary" content={content} editingField={editingField} editValue={editValue} setEditValue={setEditValue} startEditing={startEditing} saveEdit={saveEdit} />

            {/* The Problem */}
            <SectionCard title="🔴 The Problem" field="problem" content={content} editingField={editingField} editValue={editValue} setEditValue={setEditValue} startEditing={startEditing} saveEdit={saveEdit} />

            {/* Our Solution */}
            <SectionCard title="🟡 Our Solution" field="solution" content={content} editingField={editingField} editValue={editValue} setEditValue={setEditValue} startEditing={startEditing} saveEdit={saveEdit} />

            {/* The Results */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 print:p-6">
              <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-slate-900">🟢 The Results</h2>
                {editingField !== 'results' && <button onClick={() => startEditing('results', content.results)} className="text-slate-400 hover:text-[#1A9EF2] print:hidden"><Edit3 className="w-4 h-4" /></button>}
              </div>
              {editingField === 'results' ? (
                <div className="space-y-2">
                  <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={6}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm" />
                  <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white text-sm"><Save className="w-4 h-4 inline mr-1" />Save</button>
                </div>
              ) : (
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{content.results}</div>
              )}

              {/* Before/After Table */}
              {content.before_after_table && content.before_after_table.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-semibold text-slate-700">Metric</th>
                        <th className="text-left py-2 px-3 font-semibold text-slate-700">Before</th>
                        <th className="text-left py-2 px-3 font-semibold text-slate-700">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.before_after_table.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-700">{row.label}</td>
                          <td className="py-2 px-3 text-slate-500">{row.before}</td>
                          <td className="py-2 px-3 text-[#1A9EF2] font-medium">{row.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Client Testimonial */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 print:p-6">
              <div className="flex items-center gap-2 mb-4"><Quote className="w-5 h-5 text-[#1A9EF2]" /><h2 className="text-xl font-bold text-slate-900">Client Testimonial</h2></div>
              <div className="space-y-3">
                <textarea value={testimonialText} onChange={e => setTestimonialText(e.target.value)} rows={3} placeholder="Add your client's testimonial here..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm italic" />
                <input type="text" value={testimonialAuthor} onChange={e => setTestimonialAuthor(e.target.value)} placeholder="— Author name, Title"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable section card
function SectionCard({ title, field, content, editingField, editValue, setEditValue, startEditing, saveEdit }: {
  title: string; field: string; content: GeneratedCaseStudy;
  editingField: string | null; editValue: string; setEditValue: (v: string) => void;
  startEditing: (field: string, value: string) => void; saveEdit: () => void;
}) {
  const value = (content as any)[field] || '';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 print:p-6">
      <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {editingField !== field && <button onClick={() => startEditing(field, value)} className="text-slate-400 hover:text-[#1A9EF2] print:hidden"><Edit3 className="w-4 h-4" /></button>}
      </div>
      {editingField === field ? (
        <div className="space-y-2">
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={8}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1A9EF2]/30 text-sm" />
          <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[#1A9EF2] text-white text-sm"><Save className="w-4 h-4 inline mr-1" />Save</button>
        </div>
      ) : (
        <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{value}</div>
      )}
    </div>
  );
}

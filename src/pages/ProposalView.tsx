import { useState, useEffect } from 'react';
import { api, type Page } from '../lib/api';
import { Save, Loader2, FileText, Printer } from 'lucide-react';

interface Props {
  projectId: string | null;
  pages: Page[];
}

export default function ProposalView({ projectId, pages }: Props) {
  const [clientName, setClientName] = useState('');
  const [execSummary, setExecSummary] = useState('');
  const [pricing, setPricing] = useState('');
  const [timelineWeeks, setTimelineWeeks] = useState(4);
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.projects.get(projectId)
      .then(() => api.projects.get(projectId))
      .then(async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/proposal`, { credentials: 'include' });
          const data = await res.json();
          setClientName(data.client_name || '');
          setExecSummary(data.executive_summary || '');
          setPricing(data.pricing_estimate || '');
          setTimelineWeeks(data.timeline_weeks || 4);
          setTerms(data.terms_conditions || '');
        } catch { /* no proposal yet */ }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proposal`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          executive_summary: execSummary,
          pricing_estimate: pricing,
          timeline_weeks: timelineWeeks,
          terms_conditions: terms,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const pageItems = pages.map(p => `
      <div class="page-item">
        <strong>${p.title}</strong>
        <span class="type-badge">${p.page_type}</span>
        <p class="desc">${p.description || 'No description'}</p>
        <p class="goals"><em>Goals:</em> ${p.goals || '—'}</p>
        <p class="notes"><em>Notes:</em> ${p.notes || '—'}</p>
      </div>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${clientName || 'Proposal'} - TheBlueprint</title>
        <style>
          @page { margin: 1.5cm; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: #fff; line-height: 1.6; padding: 20px; }
          h1 { color: #1A9EF2; font-size: 28px; border-bottom: 3px solid #1A9EF2; padding-bottom: 8px; }
          h2 { color: #4551D3; font-size: 20px; margin-top: 30px; }
          .meta { display: flex; gap: 30px; margin: 20px 0; font-size: 14px; }
          .meta-item { background: #f1f5f9; padding: 10px 16px; border-radius: 8px; }
          .page-item { background: #f8fafc; border-left: 4px solid #1A9EF2; padding: 12px 16px; margin: 10px 0; border-radius: 4px; }
          .type-badge { display: inline-block; background: #C3E8FF; color: #1A9EF2; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; margin-left: 8px; }
          .desc { font-size: 13px; color: #444; margin: 6px 0; }
          .goals, .notes { font-size: 12px; color: #666; margin: 2px 0; }
          .page-break { page-break-before: always; break-before: page; }
          .summary { background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 10px 0; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align:center;padding:10px;background:#eee;margin-bottom:20px;">
          <button onclick="window.print()">Print / Save PDF</button>
        </div>
        <h1>${clientName || 'Project Proposal'}</h1>
        <div class="meta">
          <div class="meta-item"><strong>Timeline:</strong> ${timelineWeeks} weeks</div>
          <div class="meta-item"><strong>Pages:</strong> ${pages.length}</div>
        </div>
        <h2>Executive Summary</h2>
        <div class="summary">${execSummary || 'No summary provided.'}</div>
        <h2>Pricing Estimate</h2>
        <div class="summary">${pricing || 'Not specified.'}</div>
        <h2>Terms & Conditions</h2>
        <div class="summary">${terms || 'Standard terms apply.'}</div>
        <div class="page-break"></div>
        <h2>Sitemap & Page Details</h2>
        ${pageItems}
      </body>
      </html>
    `);
    printWin.document.close();
  };

  if (!projectId) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-600">No project selected</h3>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A9EF2]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#1A9EF2]" />
          Proposal
        </h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all"
        >
          <Printer className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Client Name</label>
          <input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="e.g. Acme Corporation"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Executive Summary</label>
          <textarea
            value={execSummary}
            onChange={e => setExecSummary(e.target.value)}
            placeholder="Brief overview of the project scope and goals..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pricing Estimate</label>
          <textarea
            value={pricing}
            onChange={e => setPricing(e.target.value)}
            placeholder="e.g. $5,000 - $8,000 depending on scope"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-20"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Timeline (weeks)</label>
            <input
              type="number"
              value={timelineWeeks}
              onChange={e => setTimelineWeeks(parseInt(e.target.value) || 4)}
              min={1}
              max={52}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pages in Sitemap</label>
            <div className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 font-semibold">
              {pages.length} page{pages.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Terms & Conditions</label>
          <textarea
            value={terms}
            onChange={e => setTerms(e.target.value)}
            placeholder="Payment terms, revision limits, delivery timeline, etc."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-24"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Proposal
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
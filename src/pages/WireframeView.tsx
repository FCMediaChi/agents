import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Save, Loader2, Plus, Trash2, HelpCircle, MessageCircle, CheckCircle2, Clock, AlertCircle, Download } from 'lucide-react';

interface Props { pageId: string | null; }

interface Block { id: string; type: string; title: string; subtitle?: string | null; content?: string | null; order: number; }

interface Comment { id: string; wireframe_id: string; block_id: string; user_email: string; text: string; created_at: string; }

const BLOCK_TEMPLATES = [
  { type: 'header', title: 'Header', subtitle: 'Logo + Navigation', content: 'Nav items: Home, About, Services, Contact' },
  { type: 'hero', title: 'Hero Section', subtitle: 'Main headline area', content: 'Button: [Primary CTA]' },
  { type: 'features', title: 'Features Grid', subtitle: '3-column feature grid', content: 'Feature 1 | Feature 2 | Feature 3' },
  { type: 'content', title: 'Content Block', subtitle: 'Main content area', content: 'Text, images, and media' },
  { type: 'cta', title: 'Call to Action', subtitle: 'Conversion section', content: 'Button: [Get Started]' },
  { type: 'pricing', title: 'Pricing Table', subtitle: 'Pricing tiers', content: 'Plan 1 | Plan 2 | Plan 3' },
  { type: 'testimonials', title: 'Testimonials', subtitle: 'Customer quotes', content: 'Quote cards in a grid' },
  { type: 'faq', title: 'FAQ Accordion', subtitle: 'Frequently asked questions', content: 'Q&A accordion items' },
  { type: 'contact', title: 'Contact Form', subtitle: 'Contact form section', content: 'Name, Email, Message fields' },
  { type: 'footer', title: 'Footer', subtitle: 'Copyright and links', content: 'Social: Twitter, LinkedIn' },
];

const BLOCK_COLORS: Record<string, string> = {
  header: 'border-l-blue-400 bg-blue-50', hero: 'border-l-violet-400 bg-violet-50',
  features: 'border-l-emerald-400 bg-emerald-50', content: 'border-l-slate-400 bg-slate-50',
  cta: 'border-l-amber-400 bg-amber-50', pricing: 'border-l-cyan-400 bg-cyan-50',
  testimonials: 'border-l-pink-400 bg-pink-50', faq: 'border-l-orange-400 bg-orange-50',
  contact: 'border-l-teal-400 bg-teal-50', footer: 'border-l-slate-600 bg-slate-100',
};

let blockCounter = 0;
function genBlockId() { blockCounter++; return `blk-${blockCounter}-${Date.now().toString(36)}`; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  in_review: { label: 'In Review', color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  changes_requested: { label: 'Changes Requested', color: 'bg-red-100 text-red-700' },
};

export default function WireframeView({ pageId }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState('draft');
  const [comments, setComments] = useState<Comment[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    Promise.all([
      api.wireframes.get(pageId).then(data => { setBlocks(data.blocks || []); setApprovalStatus((data as any).approval_status || 'draft'); }).catch(() => { setBlocks([]); setApprovalStatus('draft'); }),
      fetch(`/api/pages/${pageId}/wireframe/comments`, { credentials: 'include' }).then(r => r.json()).then(d => setComments(d.comments || [])).catch(() => setComments([])),
    ]).finally(() => setLoading(false));
  }, [pageId]);

  const handleSave = async () => {
    if (!pageId) return;
    setSaving(true);
    try { await api.wireframes.saveBlocks(pageId, blocks); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleApprove = async (status: string) => {
    if (!pageId) return;
    try {
      await fetch(`/api/pages/${pageId}/wireframe/approve`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }), credentials: 'include',
      });
      setApprovalStatus(status);
    } catch { /* ignore */ }
  };

  const addComment = async (blockId: string) => {
    if (!commentText.trim() || !pageId) return;
    setCommentSending(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/wireframe/comments/${blockId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText }), credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) { setComments([...comments, data]); setCommentText(''); }
    } catch { /* ignore */ }
    finally { setCommentSending(false); }
  };

  const handleExportHTML = async () => {
    if (!pageId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/pages/${pageId}/wireframe/export-html`, { method: 'POST', credentials: 'include' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'wireframe-prototype.html'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExporting(false); }
  };

  const updateBlock = (id: string, field: string, value: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    setBlocks(prev => { const copy = [...prev]; [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]; return copy.map((b, i) => ({ ...b, order: i })); });
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i })));
  };

  const blockCommentCount = (blockId: string) => comments.filter(c => c.block_id === blockId).length;

  if (!pageId) return <div className="p-12 text-center"><HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">Select a page to view its wireframe</p></div>;
  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#1A9EF2]" /></div>;

  return (
    <div className="p-6 space-y-4">
      {/* Approval bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Approval Status:</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_LABELS[approvalStatus]?.color || 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABELS[approvalStatus]?.label || approvalStatus}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleApprove('in_review')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all">
            <Clock className="w-3 h-3 inline mr-1" /> Submit for Review
          </button>
          <button onClick={() => handleApprove('approved')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">
            <CheckCircle2 className="w-3 h-3 inline mr-1" /> Approve
          </button>
          <button onClick={() => handleApprove('changes_requested')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all">
            <AlertCircle className="w-3 h-3 inline mr-1" /> Request Changes
          </button>
        </div>
      </div>

      {/* Blocks */}
      {blocks.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-xl">
          <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-3">No wireframe blocks yet</p>
        </div>
      )}

      {blocks.map((block, idx) => {
        const count = blockCommentCount(block.id);
        const isExpanded = expandedBlock === block.id;
        const blockComments = comments.filter(c => c.block_id === block.id);

        return (
        <div key={block.id} className={`rounded-xl border border-slate-200 border-l-4 ${BLOCK_COLORS[block.type] || 'border-l-slate-400 bg-slate-50'} p-4 shadow-sm`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{block.type}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => { setExpandedBlock(isExpanded ? null : block.id); if (!isExpanded) setCommentText(''); }}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${count > 0 ? 'text-[#1A9EF2] bg-[#C3E8FF]/30' : 'text-slate-400 hover:text-[#1A9EF2]'}`}
                title="Comments">
                <MessageCircle className="w-3.5 h-3.5" />
                {count > 0 && <span className="text-[10px]">{count}</span>}
              </button>
              <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Move up">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
              </button>
              <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Move down">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </button>
              <button onClick={() => deleteBlock(block.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <input value={block.title} onChange={e => updateBlock(block.id, 'title', e.target.value)}
            className="w-full mb-1 px-2 py-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 bg-white/80 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none" />
          <input value={block.subtitle || ''} onChange={e => updateBlock(block.id, 'subtitle', e.target.value)}
            placeholder="Subtitle" className="w-full mb-1 px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-500 bg-white/80 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none" />
          <textarea value={block.content || ''} onChange={e => updateBlock(block.id, 'content', e.target.value)}
            placeholder="Content..." className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 bg-white/80 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none resize-none h-14" />

          {/* Comment thread */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              {blockComments.map(c => (
                <div key={c.id} className="mb-2 p-2 rounded-lg bg-white border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">{c.user_email}</span>
                    <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-600">{c.text}</p>
                </div>
              ))}
              {blockComments.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No comments yet</p>}
              <div className="flex gap-2 mt-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..." className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#1A9EF2]"
                  onKeyDown={e => e.key === 'Enter' && addComment(block.id)} />
                <button onClick={() => addComment(block.id)} disabled={commentSending || !commentText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-[#1A9EF2] text-white text-xs font-semibold hover:bg-[#4551D3] transition-all disabled:opacity-50">
                  {commentSending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      )})}

      {/* Add block & Save */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-slate-500 font-semibold text-sm hover:border-[#1A9EF2] hover:text-[#1A9EF2] transition-all">
          <Plus className="w-4 h-4" /> Add Block
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Wireframe
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
        <button onClick={handleExportHTML} disabled={exporting || blocks.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#1A9EF2] text-[#1A9EF2] font-semibold text-sm hover:bg-[#C3E8FF]/20 transition-all disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export HTML
        </button>
      </div>

      {/* Block Template Picker */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg border border-slate-200 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Add Wireframe Block</h3>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
              {BLOCK_TEMPLATES.map(t => (
                <button key={t.type} onClick={() => { setBlocks(prev => [...prev, { id: genBlockId(), type: t.type, title: t.title, subtitle: t.subtitle, content: t.content, order: prev.length }]); setShowPicker(false); }}
                  className="text-left p-3 rounded-xl border border-slate-200 hover:border-[#1A9EF2] hover:shadow-sm transition-all">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1A9EF2]">{t.type}</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{t.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t.subtitle}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setShowPicker(false)} className="mt-4 w-full py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

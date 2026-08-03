import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type Page, type Project } from '../lib/api';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Save, Loader2, FileText, HelpCircle, ClipboardList, Layout, ScrollText } from 'lucide-react';
import QuestionnaireView from './QuestionnaireView';
import WireframeView from './WireframeView';
import ProposalView from './ProposalView';

const PAGE_TYPE_LABELS: Record<string, string> = {
  homepage: 'Homepage',
  about: 'About',
  services: 'Services',
  shop: 'Shop',
  contact: 'Contact',
  blog: 'Blog',
  pricing: 'Pricing',
  generic: 'Page',
};

const PAGE_TYPE_COLORS: Record<string, string> = {
  homepage: 'bg-emerald-100 text-emerald-700',
  about: 'bg-blue-100 text-blue-700',
  services: 'bg-purple-100 text-purple-700',
  shop: 'bg-orange-100 text-orange-700',
  contact: 'bg-amber-100 text-amber-700',
  blog: 'bg-pink-100 text-pink-700',
  pricing: 'bg-cyan-100 text-cyan-700',
  generic: 'bg-slate-100 text-slate-600',
};

type PageTab = 'outline' | 'questionnaire' | 'wireframe';

interface TreeItem {
  page: Page;
  children: TreeItem[];
  depth: number;
}

function buildTree(pages: Page[]): TreeItem[] {
  const map = new Map<string, TreeItem>();
  const roots: TreeItem[] = [];
  const sorted = [...pages].sort((a, b) => a.sort_order - b.sort_order);
  for (const page of sorted) {
    map.set(page.id, { page, children: [], depth: 0 });
  }
  for (const item of map.values()) {
    if (item.page.parent_id && map.has(item.page.parent_id)) {
      const parent = map.get(item.page.parent_id)!;
      item.depth = parent.depth + 1;
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  }
  const sortChildren = (items: TreeItem[]) => {
    items.sort((a, b) => a.page.sort_order - b.page.sort_order);
    items.forEach(c => sortChildren(c.children));
  };
  sortChildren(roots);
  return roots;
}

function flattenTree(items: TreeItem[]): TreeItem[] {
  const result: TreeItem[] = [];
  for (const item of items) {
    result.push(item);
    result.push(...flattenTree(item.children));
  }
  return result;
}

const TABS: { key: PageTab; label: string; icon: any }[] = [
  { key: 'outline', label: 'Outline', icon: FileText },
  { key: 'questionnaire', label: 'Questions', icon: ClipboardList },
  { key: 'wireframe', label: 'Wireframe', icon: Layout },
];

export default function SitemapBuilderPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('generic');
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>('outline');
  const [globalTab, setGlobalTab] = useState<'sitemap' | 'proposal'>('sitemap');

  // Outline editor state
  const [outlineDesc, setOutlineDesc] = useState('');
  const [outlineGoals, setOutlineGoals] = useState('');
  const [outlineNotes, setOutlineNotes] = useState('');
  const [savingOutline, setSavingOutline] = useState(false);
  const [outlineSaved, setOutlineSaved] = useState(false);

  const selectedPage = pages.find(p => p.id === selectedPageId) || null;
  const tree = buildTree(pages);
  const flatTree = flattenTree(tree);

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [proj, pgList] = await Promise.all([
        api.projects.get(projectId),
        api.pages.list(projectId),
      ]);
      setProject(proj);
      setPages(pgList);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  useEffect(() => {
    if (selectedPage) {
      setOutlineDesc(selectedPage.description || '');
      setOutlineGoals(selectedPage.goals || '');
      setOutlineNotes(selectedPage.notes || '');
    }
  }, [selectedPageId, pages]);

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !editTitle.trim()) return;
    setSaving(true);
    try {
      await api.pages.create(projectId, {
        title: editTitle.trim(),
        page_type: editType,
        parent_id: editParentId,
      });
      setEditTitle('');
      setEditType('generic');
      setEditParentId(null);
      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!projectId || !confirm('Delete this page and all its children?')) return;
    try {
      await api.pages.delete(projectId, pageId);
      if (selectedPageId === pageId) setSelectedPageId(null);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMoveUp = async (page: Page) => {
    if (!projectId) return;
    const siblings = pages.filter(p => p.parent_id === page.parent_id && p.id !== page.id).sort((a, b) => a.sort_order - b.sort_order);
    const above = siblings.find(s => s.sort_order < page.sort_order);
    if (!above) return;
    try {
      await api.pages.update(projectId, page.id, { ...page, sort_order: above.sort_order });
      await api.pages.update(projectId, above.id, { ...above, sort_order: page.sort_order });
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleMoveDown = async (page: Page) => {
    if (!projectId) return;
    const siblings = pages.filter(p => p.parent_id === page.parent_id && p.id !== page.id).sort((a, b) => a.sort_order - b.sort_order);
    const below = siblings.find(s => s.sort_order > page.sort_order);
    if (!below) return;
    try {
      await api.pages.update(projectId, page.id, { ...page, sort_order: below.sort_order });
      await api.pages.update(projectId, below.id, { ...below, sort_order: page.sort_order });
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleSaveOutline = async () => {
    if (!projectId || !selectedPageId) return;
    setSavingOutline(true);
    try {
      await api.pages.saveOutline(projectId, selectedPageId, {
        description: outlineDesc,
        goals: outlineGoals,
        notes: outlineNotes,
      });
      setOutlineSaved(true);
      setTimeout(() => setOutlineSaved(false), 2000);
      await loadData();
    } catch (err: any) { alert(err.message); } finally { setSavingOutline(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A9EF2]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Project not found</h2>
          <Link to="/app" className="text-[#1A9EF2] hover:underline mt-2 inline-block">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{project.title}</h1>
              {project.description && <p className="text-xs text-slate-500">{project.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Global Tabs: Sitemap | Proposal */}
            <div className="flex bg-slate-100 rounded-xl p-0.5">
              <button
                onClick={() => setGlobalTab('sitemap')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${globalTab === 'sitemap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sitemap
              </button>
              <button
                onClick={() => setGlobalTab('proposal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${globalTab === 'proposal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ScrollText className="w-3.5 h-3.5" />
                Proposal
              </button>
            </div>
            {globalTab === 'sitemap' && (
              <button
                onClick={() => { setEditParentId(null); setShowAddModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Page
              </button>
            )}
          </div>
        </div>
      </header>

      {globalTab === 'proposal' ? (
        /* Proposal View (full width) */
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <ProposalView projectId={projectId!} pages={pages} />
        </div>
      ) : (
        /* Sitemap Builder View */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex gap-6">
          {/* Sitemap Tree Panel */}
          <div className="w-[400px] shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1A9EF2]" />
                  Sitemap
                </h2>
                <span className="text-xs text-slate-400">{pages.length} pages</span>
              </div>

              {pages.length === 0 ? (
                <div className="p-8 text-center">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No pages yet</p>
                  <button
                    onClick={() => { setEditParentId(null); setShowAddModal(true); }}
                    className="mt-3 text-sm text-[#1A9EF2] font-semibold hover:underline"
                  >
                    Add your first page
                  </button>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {flatTree.map(item => (
                    <div key={item.page.id}>
                      <div
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl cursor-pointer transition-all group ${
                          selectedPageId === item.page.id
                            ? 'bg-[#C3E8FF] border border-[#6DC7FF]'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                        style={{ paddingLeft: `${12 + item.depth * 20}px` }}
                        onClick={() => { setSelectedPageId(item.page.id); setPageTab('outline'); }}
                      >
                        {item.children.length > 0 ? (
                          item.depth === 0 ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <span className="text-sm font-medium text-slate-800 truncate flex-1">{item.page.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PAGE_TYPE_COLORS[item.page.page_type] || PAGE_TYPE_COLORS.generic}`}>
                          {PAGE_TYPE_LABELS[item.page.page_type] || 'Page'}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={e => { e.stopPropagation(); handleMoveUp(item.page); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600" title="Move up">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleMoveDown(item.page); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600" title="Move down">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeletePage(item.page.id); }} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete page">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Page Detail */}
          <div className="flex-1">
            {selectedPage ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                {/* Page Header */}
                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{selectedPage.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PAGE_TYPE_COLORS[selectedPage.page_type] || PAGE_TYPE_COLORS.generic}`}>
                      {PAGE_TYPE_LABELS[selectedPage.page_type] || 'Page'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Slug: /{selectedPage.slug}</p>
                </div>

                {/* Page Tabs */}
                <div className="flex border-b border-slate-100 px-6">
                  {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setPageTab(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                          pageTab === tab.key
                            ? 'border-[#1A9EF2] text-[#1A9EF2]'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content */}
                {pageTab === 'outline' && (
                  <div className="p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Page Description</label>
                      <textarea value={outlineDesc} onChange={e => setOutlineDesc(e.target.value)} placeholder="Describe the purpose of this page..." className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-24" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Goals / Objectives</label>
                      <textarea value={outlineGoals} onChange={e => setOutlineGoals(e.target.value)} placeholder="What should this page accomplish?" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-20" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Designer / Developer Notes</label>
                      <textarea value={outlineNotes} onChange={e => setOutlineNotes(e.target.value)} placeholder="Specific requirements, integrations, or design notes..." className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-20" />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button onClick={handleSaveOutline} disabled={savingOutline} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50">
                        {savingOutline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Outline
                      </button>
                      {outlineSaved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
                    </div>
                  </div>
                )}
                {pageTab === 'questionnaire' && <QuestionnaireView pageId={selectedPageId} />}
                {pageTab === 'wireframe' && <WireframeView pageId={selectedPageId} />}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-600">Select a page</h3>
                <p className="text-slate-400 text-sm mt-1">Click a page in the sitemap tree to edit its details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Page Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddPage} className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-slate-900">Add New Page</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Page Title</label>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm" placeholder="e.g. About Us" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Page Type</label>
              <select value={editType} onChange={e => setEditType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm bg-white">
                {Object.entries(PAGE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Parent Page (optional)</label>
              <select value={editParentId || ''} onChange={e => setEditParentId(e.target.value || null)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm bg-white">
                <option value="">— Top Level —</option>
                {pages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving || !editTitle.trim()} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Page
              </button>
              <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
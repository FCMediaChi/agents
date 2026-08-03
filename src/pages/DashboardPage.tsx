import { useState, useEffect } from 'react';
import { api, type Project } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Compass, Plus, LogOut, Loader2, FileText, ExternalLink, Trash2, Users, X, Check } from 'lucide-react';

interface Member {
  id: string; email: string; role: string; status: string; invited_at: string;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newWebsiteType, setNewWebsiteType] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Share modal state
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadProjects = async () => {
    try {
      const list = await api.projects.list();
      setProjects(list);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.projects.create(newTitle.trim(), newDesc.trim() || undefined, newWebsiteType);
      setNewTitle('');
      setNewDesc('');
      setNewWebsiteType(null);
      setShowNew(false);
      await loadProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its pages? This cannot be undone.')) return;
    try {
      await api.projects.delete(id);
      await loadProjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openShareModal = async (projectId: string) => {
    setShareProjectId(projectId);
    setInviteEmail('');
    setInviteRole('editor');
    setInviteError('');
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, { credentials: 'include' });
      const data = await res.json();
      setMembers(data.members || []);
    } catch { setMembers([]); }
    finally { setMembersLoading(false); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !shareProjectId) return;
    setInviteLoading(true);
    setInviteError('');
    setCopied(false);
    try {
      const res = await fetch(`/api/projects/${shareProjectId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error || 'Failed to invite'); return; }
      const newMember = { ...data, accessToken: data.accessToken };
      setMembers([...members, newMember]);
      setInviteEmail('');
      // Copy client link if role is client
      if (inviteRole === 'client' && data.accessToken) {
        const link = `${window.location.origin}/project/${shareProjectId}/client?token=${data.accessToken}`;
        try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch {}
      }
    } catch { setInviteError('Network error'); }
    finally { setInviteLoading(false); }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!shareProjectId) return;
    try {
      await fetch(`/api/projects/${shareProjectId}/members/${memberId}`, { method: 'DELETE', credentials: 'include' });
      setMembers(members.filter(m => m.id !== memberId));
    } catch { /* ignore */ }
  };

  const tierLabel = (tier: string) => {
    switch (tier) {
      case 'FREE': return 'Free';
      case 'SOLO': return 'Solo';
      case 'TEAM': return 'Team';
      case 'AGENCY': return 'Agency';
      default: return tier;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A9EF2] flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Nuria Website Blueprint</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/app/account" className="text-sm text-slate-500 hover:text-[#1A9EF2] transition-colors">Settings</a>
            <span className="text-sm text-slate-500">{user?.email}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-[#C3E8FF] text-[#1A9EF2] font-semibold">
              {tierLabel(user?.subscription_tier || 'FREE')}
            </span>
            <button onClick={logout} className="text-slate-400 hover:text-slate-600 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Projects</h1>
            <p className="text-slate-500 text-sm mt-1">Select a project to build its sitemap and outlines</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* New Project Form */}
        {showNew && (
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 space-y-4">
            <h3 className="font-bold text-slate-900">Create New Project</h3>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Project title (e.g. Acme Corp Website)"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm"
              required
            />
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Brief description (optional)"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm resize-none h-20"
            />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Website Type</label>
              <select value={newWebsiteType ?? ''} onChange={e => setNewWebsiteType(e.target.value || null)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#1A9EF2] focus:ring-2 focus:ring-[#C3E8FF] outline-none text-sm bg-white">
                <option value="">— Select type (optional) —</option>
                <option value="ecommerce">E-Commerce</option>
                <option value="business">Business (Local Business)</option>
                <option value="saas">SaaS</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating || !newTitle.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create Project
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </form>
        )}

        {/* Project List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#1A9EF2]" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-2xl">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-600">No projects yet</h3>
            <p className="text-slate-400 text-sm mt-1">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map(project => (
              <div key={project.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-[#C3E8FF] transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <a href={`/app/projects/${project.id}`}
                      className="text-lg font-bold text-slate-900 hover:text-[#1A9EF2] transition-colors flex items-center gap-2">
                      {project.title}
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#1A9EF2]" />
                    </a>
                    {project.description && <p className="text-slate-500 text-sm mt-1">{project.description}</p>}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                      <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openShareModal(project.id)}
                      className="p-2 rounded-lg text-slate-300 hover:text-[#1A9EF2] hover:bg-[#C3E8FF]/20 transition-all"
                      title="Share project">
                      <Users className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(project.id)}
                      className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete project">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Share Modal */}
      {shareProjectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShareProjectId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Share Project</h2>
              <button onClick={() => setShareProjectId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Invite form */}
            <form onSubmit={handleInvite} className="flex gap-2 mb-1">
              <input type="email" value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteError(''); }}
                placeholder="colleague@email.com" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#1A9EF2]"
                disabled={inviteLoading} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="px-2 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                <option value="editor">Editor</option>
                <option value="client">Client</option>
              </select>
              <button type="submit" disabled={inviteLoading || !inviteEmail.trim()}
                className="px-4 py-2 rounded-xl bg-[#1A9EF2] hover:bg-[#4551D3] disabled:bg-slate-300 text-white text-sm font-semibold transition-all">
                {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
              </button>
            </form>
            {inviteError && <p className="text-xs text-red-500 mb-2">{inviteError}</p>}
            {copied && <p className="text-xs text-green-600 mb-2 flex items-center gap-1"><Check className="w-3 h-3" /> Client portal link copied to clipboard</p>}

            {/* Members list */}
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Members</h3>
              {membersLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#1A9EF2] mx-auto" />
              ) : members.length === 0 ? (
                <p className="text-xs text-slate-400">No collaborators yet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{m.email}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                          m.role === 'editor' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {m.role} · {m.status}
                        </span>
                      </div>
                      <button onClick={() => handleRemoveMember(m.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

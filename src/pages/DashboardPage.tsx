import { useState, useEffect } from 'react';
import { api, type Project } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Compass, Plus, LogOut, Loader2, FileText, ExternalLink, Trash2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

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
      await api.projects.create(newTitle.trim(), newDesc.trim() || undefined);
      setNewTitle('');
      setNewDesc('');
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A9EF2] flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">SiteBlueprint</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.email}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-[#C3E8FF] text-[#1A9EF2] font-semibold">
              {user?.subscription_tier === 'FREE' ? 'Free' : 'Premium'}
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
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Project
              </button>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Project List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#1A9EF2]" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-2xl">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-600">No projects yet</h3>
            <p className="text-slate-400 text-sm mt-1">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-[#C3E8FF] transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <a
                      href={`/app/projects/${project.id}`}
                      className="text-lg font-bold text-slate-900 hover:text-[#1A9EF2] transition-colors flex items-center gap-2"
                    >
                      {project.title}
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#1A9EF2]" />
                    </a>
                    {project.description && (
                      <p className="text-slate-500 text-sm mt-1">{project.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                      <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
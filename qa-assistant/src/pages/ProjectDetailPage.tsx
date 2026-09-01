import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Globe, User } from 'lucide-react';
import { api, type Project } from '../lib/api';
import { PLATFORMS, WEBSITE_TYPES, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../lib/constants';
import { Alert, Button, Card, Field, Input, Select, Spinner, StatusBadge, Textarea } from '../components/ui';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [clientName, setClientName] = useState('');
  const [platform, setPlatform] = useState('Other');
  const [websiteType, setWebsiteType] = useState('Other');
  const [status, setStatus] = useState<Project['status']>('not_started');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    api.projects
      .get(id)
      .then((p) => {
        setProject(p);
        hydrate(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  const hydrate = (p: Project) => {
    setName(p.name);
    setWebsiteUrl(p.website_url ?? '');
    setClientName(p.client_name ?? '');
    setPlatform(p.platform);
    setWebsiteType(p.website_type);
    setStatus(p.status);
    setNotes(p.notes ?? '');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 text-brand" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Alert>{error || 'Project not found'}</Alert>
        <Link to="/projects" className="text-sm font-medium text-brand hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.projects.update(project.id, {
        name,
        website_url: websiteUrl || null,
        client_name: clientName || null,
        platform,
        website_type: websiteType,
        status,
        notes: notes || null,
      });
      setProject(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.projects.delete(project.id);
      navigate('/projects', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete project.');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <div className="mt-1">
            <StatusBadge status={project.status} />
          </div>
        </div>
        {!editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {editing ? (
        <Card className="mt-6 p-6 sm:p-8">
          <form onSubmit={handleSave} className="space-y-5">
            <Field label="Project name" htmlFor="name">
              <Input id="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Website URL" htmlFor="url">
              <Input id="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
            </Field>
            <Field label="Client / business name" htmlFor="client">
              <Input id="client" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Platform" htmlFor="platform">
                <Select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Website type" htmlFor="type">
                <Select id="type" value={websiteType} onChange={(e) => setWebsiteType(e.target.value)}>
                  {WEBSITE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="QA status" htmlFor="status">
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as Project['status'])}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => { setEditing(false); hydrate(project); }}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <dl className="divide-y divide-slate-100">
            <Row label="Client / business" value={project.client_name || '—'} icon={<User className="h-4 w-4" />} />
            <Row label="Website URL" value={project.website_url || '—'} icon={<Globe className="h-4 w-4" />} href={project.website_url || undefined} />
            <Row label="Platform" value={project.platform} />
            <Row label="Website type" value={project.website_type} />
            <Row label="Notes" value={project.notes || '—'} />
            <Row label="Last updated" value={new Date(project.updated_at).toLocaleString()} />
          </dl>
        </Card>
      )}

      {/* Upcoming capabilities */}
      <Card className="mt-6 border-dashed p-6 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">What's next</p>
        <p className="mt-1">The structured QA checklist, scoring, and launch-readiness engine arrive in the next phase of development.</p>
      </Card>

      {/* Delete */}
      <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        {confirmingDelete ? (
          <div className="mt-3">
            <p className="text-sm text-red-700">
              Delete this QA project? This will permanently remove the project and its QA history.
            </p>
            <div className="mt-3 flex gap-3">
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Yes, delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="mt-3" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete project
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, icon, href }: { label: string; value: string; icon?: React.ReactNode; href?: string }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <dt className="flex items-center gap-2 text-sm font-medium text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-slate-900">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

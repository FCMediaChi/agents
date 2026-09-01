import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PLATFORMS, WEBSITE_TYPES } from '../lib/constants';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../components/ui';

export default function ProjectNewPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [clientName, setClientName] = useState('');
  const [platform, setPlatform] = useState('Other');
  const [websiteType, setWebsiteType] = useState('Other');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const project = await api.projects.create({
        name,
        website_url: websiteUrl || null,
        client_name: clientName || null,
        platform,
        website_type: websiteType,
        notes: notes || null,
      });
      navigate(`/projects/${project.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">New QA review</h1>
      <p className="mt-1 text-sm text-slate-500">Set up the website you're reviewing before launch.</p>

      <Card className="mt-6 p-6 sm:p-8">
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Project name" htmlFor="name">
            <Input
              id="name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme website redesign"
            />
          </Field>

          <Field label="Website URL" htmlFor="url" hint="Optional — http(s) only">
            <Input
              id="url"
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </Field>

          <Field label="Client / business name" htmlFor="client">
            <Input
              id="client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Acme Inc."
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Platform" htmlFor="platform">
              <Select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Website type" htmlFor="type">
              <Select id="type" value={websiteType} onChange={(e) => setWebsiteType(e.target.value)}>
                {WEBSITE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes" hint="Optional context, goals, or contacts">
            <Textarea
              id="notes"
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the reviewer should know..."
            />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create project
            </Button>
          </div>
        </form>

        <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
          QA scope selection (categories to review) arrives in the next phase.
        </p>
      </Card>
    </div>
  );
}

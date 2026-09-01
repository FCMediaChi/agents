import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, ClipboardCheck } from 'lucide-react';
import { api, type Project } from '../lib/api';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../lib/constants';
import { Button, Card, Spinner, Alert } from '../components/ui';
import ProjectCard from '../components/ProjectCard';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 text-brand" />
      </div>
    );
  }

  if (error) {
    return <Alert>{error}</Alert>;
  }

  const counts = PROJECT_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.status === s).length;
    return acc;
  }, {});

  const recent = projects.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Link to="/projects/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New QA Review
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center justify-center p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-secondary">
            <ClipboardCheck className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Your QA workspace is ready</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-600">
            Create your first website review to start working through a structured pre-launch checklist.
          </p>
          <Link to="/projects/new" className="mt-5">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Create your first review
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm text-slate-500">Total projects</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{projects.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">In progress</p>
              <p className="mt-1 text-2xl font-semibold text-brand-secondary">{counts.in_progress}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">Needs attention</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{counts.needs_attention}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">Ready for launch</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">{counts.ready_for_launch}</p>
            </Card>
          </div>

          {/* Status breakdown */}
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {PROJECT_STATUSES.map((s) => (
              <Card key={s} className="p-4 text-center">
                <p className="text-2xl font-semibold text-slate-900">{counts[s]}</p>
                <p className="mt-0.5 text-xs text-slate-500">{PROJECT_STATUS_LABELS[s]}</p>
              </Card>
            ))}
          </div>

          {/* Recent projects */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <FolderKanban className="h-5 w-5 text-slate-400" />
                Recent projects
              </h2>
              <Link to="/projects" className="text-sm font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

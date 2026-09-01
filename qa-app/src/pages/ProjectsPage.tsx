import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban } from 'lucide-react';
import { api, type Project } from '../lib/api';
import { Button, Card, Spinner, Alert } from '../components/ui';
import ProjectCard from '../components/ProjectCard';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.projects
      .list()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
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
            <FolderKanban className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No projects yet</h2>
          <p className="mt-1 text-sm text-slate-600">Create your first QA review to get started.</p>
          <Link to="/projects/new" className="mt-5">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

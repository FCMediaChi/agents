import { Link } from 'react-router-dom';
import { Globe, User } from 'lucide-react';
import type { Project } from '../lib/api';
import { StatusBadge } from './ui';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{project.name}</h3>
          {project.client_name && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500">
              <User className="h-3.5 w-3.5" />
              {project.client_name}
            </p>
          )}
          {project.website_url && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500">
              <Globe className="h-3.5 w-3.5" />
              {project.website_url}
            </p>
          )}
        </div>
        <StatusBadge status={project.status} />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>{project.platform}</span>
        <span>Updated {relativeTime(project.updated_at)}</span>
      </div>
    </Link>
  );
}

import { LayoutTemplate, Plus } from 'lucide-react';
import { Card } from '../components/ui';
import { useAuth } from '../lib/auth';
import { DELIVERABLES } from '../lib/constants';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Your website planning workspace.</p>
        </div>
        <button
          type="button"
          disabled
          title="Project creation arrives with the builder (Phase 2)"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500"
        >
          <Plus className="h-4 w-4" />
          New project
        </button>
      </div>

      <Card className="mt-8 flex flex-col items-center justify-center p-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-secondary">
          <LayoutTemplate className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Your planning workspace is ready</h2>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Projects will live here. The sitemap builder, page outlines, content questionnaires,
          wireframes, and proposal export arrive in the next phase of development.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Signed in as {user?.email} · {user?.subscription_tier ?? 'FREE'} plan
        </p>
      </Card>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What you'll build</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DELIVERABLES.map(({ key, title, text }) => (
            <Card key={key} className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
              <p className="mt-3 text-xs font-medium text-slate-400">Coming in Phase 2</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

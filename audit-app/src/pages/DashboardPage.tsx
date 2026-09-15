import { ClipboardCheck, Search } from 'lucide-react';
import { Card } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <Card className="mt-8 flex flex-col items-center justify-center p-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-secondary">
          <Search className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Your audit workspace is ready</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-600">
          Website audits will run here. The audit engine — which analyzes your live site across
          design, UX, accessibility, SEO, and conversion — arrives in the next phase of development.
        </p>
        <p className="mt-3 text-xs text-slate-400">Signed in as {user?.email}</p>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <ClipboardCheck className="h-4 w-4" />
          Nuria Website Audit
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Send, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Alert, Card, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { api, ApiError, type PipelineMe } from '../lib/api';

function trialDaysLeft(me: PipelineMe): number {
  if (!me.trial_active || !me.trial_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(me.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [me, setMe] = useState<PipelineMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { user: m } = await api.pipeline.me();
        if (active) setMe(m);
      } catch (err) {
        if (active) {
          const message = err instanceof ApiError && err.code === 'TRIAL_EXPIRED'
            ? 'Your 7-day free trial has ended. Pricing and checkout arrive in a later phase.'
            : err instanceof Error ? err.message : 'Unable to load pipeline status.';
          setError(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const daysLeft = me ? trialDaysLeft(me) : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      {/* Trial / plan status */}
      <div className="mt-6">
        {loading ? (
          <Card className="flex items-center gap-3 p-5 text-sm text-slate-600">
            <Spinner className="h-4 w-4 text-brand" />
            Loading your plan status…
          </Card>
        ) : error ? (
          <Alert variant="error">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </span>
          </Alert>
        ) : me && me.subscription_tier !== 'FREE' ? (
          <Card className="flex items-center gap-3 p-5 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="font-medium text-slate-700">Active plan: {me.subscription_tier}</span>
          </Card>
        ) : me && me.trial_active ? (
          <Card className="flex items-center gap-3 p-5 text-sm">
            <Clock className="h-5 w-5 text-brand" />
            <span className="font-medium text-slate-700">
              Free trial active — {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </span>
          </Card>
        ) : null}
      </div>

      {/* Empty workspace shell */}
      <Card className="mt-8 flex flex-col items-center justify-center p-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-secondary">
          <Send className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Your pipeline workspace is ready</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-600">
          Case studies and cold pitches will live here. The generators — which turn your screenshots
          and a prospect's site into drafts — arrive in the next phase of development.
        </p>
        <p className="mt-3 text-xs text-slate-400">Signed in as {user?.email}</p>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <Send className="h-4 w-4" />
          Nuria Client Pipeline
        </div>
      </Card>
    </div>
  );
}

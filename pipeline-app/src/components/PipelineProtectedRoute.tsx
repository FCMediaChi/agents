import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { pipelineApi } from '../lib/pipelineApi';

/**
 * Gates the in-app Pipeline routes (onboarding/dashboard/case-study/cold-pitch).
 *
 * Deliberately self-contained: it checks the Pipeline token via `pipelineApi.auth.me()`
 * rather than the shared `useAuth()` context, because the Pipeline auth flow
 * (login/register) goes through `pipelineApi` and does not update that context.
 */
export default function PipelineProtectedRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'authed' | 'unauth'>('loading');

  useEffect(() => {
    let mounted = true;
    pipelineApi.auth.me()
      .then(() => { if (mounted) setState('authed'); })
      .catch(() => { if (mounted) setState('unauth'); });
    return () => { mounted = false; };
  }, []);

  if (state === 'loading') return null;
  if (state === 'unauth') return <Navigate to="/pipeline/login" replace />;
  return <>{children}</>;
}

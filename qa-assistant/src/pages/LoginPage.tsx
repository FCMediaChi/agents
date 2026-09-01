import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Alert, Button, Card, Field, Input, Spinner } from '../components/ui';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-brand" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold text-slate-800">Nuria Design QA Assistant</span>
      </Link>

      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in to continue your QA reviews.</p>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={submitting} className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-brand hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}

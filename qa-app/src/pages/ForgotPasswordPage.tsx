import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.auth.requestPasswordReset(email);
      setSubmitted(true);
      if (res.debug_reset_token) setDebugToken(res.debug_reset_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request a reset.');
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
        <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your account email and we'll help you get back in.</p>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <Alert variant="success">
              If an account exists for that email, a password reset link has been sent.
            </Alert>
            {debugToken && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold">Development reset link</p>
                <p className="mt-1 break-all">Token: {debugToken}</p>
                <p className="mt-1">
                  <Link to={`/reset-password?token=${encodeURIComponent(debugToken)}`} className="font-medium text-brand hover:underline">
                    Open reset page
                  </Link>
                </p>
              </div>
            )}
            <Link to="/login" className="block text-center text-sm font-medium text-brand hover:underline">
              Back to log in
            </Link>
          </div>
        ) : (
          <>
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
              <Button type="submit" loading={submitting} className="w-full">
                Send reset link
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              Remembered your password?{' '}
              <Link to="/login" className="font-semibold text-brand hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

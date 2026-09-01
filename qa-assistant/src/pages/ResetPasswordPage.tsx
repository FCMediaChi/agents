import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Alert, Button, Card, Field, Input } from '../components/ui';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Missing reset token. Use the link from your email.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.resetPassword(token.trim(), password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
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
        <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter a new password for your account.</p>

        {success ? (
          <div className="mt-6 space-y-4">
            <Alert variant="success">Your password has been reset. You can now log in.</Alert>
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to log in
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-4">
                <Alert>{error}</Alert>
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Reset token" htmlFor="token" hint="Pasted from your reset link">
                <Input
                  id="token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your reset token"
                />
              </Field>
              <Field label="New password" htmlFor="password" hint="At least 8 characters">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm">
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              <Button type="submit" loading={submitting} className="w-full">
                Reset password
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Alert, Button, Card, Field, Input, Spinner } from '../components/ui';
import Brand from '../components/Brand';

interface VerifyLocationState {
  email?: string;
  justSent?: boolean;
  emailDelivered?: boolean;
  devVerificationToken?: string;
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const state = (location.state as VerifyLocationState | null) ?? {};

  const tokenFromUrl = searchParams.get('token') || '';
  const emailFromUrl = searchParams.get('email') || state.email || '';

  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>(
    tokenFromUrl ? 'verifying' : 'idle',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState(emailFromUrl);
  const [resending, setResending] = useState(false);
  const [resentMessage, setResentMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(state.devVerificationToken ?? null);

  // Auto-verify when arriving from the emailed link (?token=…).
  const verifiedRef = useRef(false);
  useEffect(() => {
    if (!tokenFromUrl || verifiedRef.current) return;
    verifiedRef.current = true;
    (async () => {
      try {
        const result = await api.auth.verifyEmail(tokenFromUrl);
        setStatus('verified');
        setMessage(result.message);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'This verification link is invalid or has expired.');
      }
    })();
  }, [tokenFromUrl]);

  const handleResend = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResentMessage(null);
    setResending(true);
    try {
      const result = await api.auth.resendVerification(email);
      setResentMessage(result.message);
      if (result.dev_verification_token) setDevToken(result.dev_verification_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyNow = async () => {
    if (!devToken) return;
    setStatus('verifying');
    setError(null);
    try {
      const result = await api.auth.verifyEmail(devToken);
      setStatus('verified');
      setMessage(result.message);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unable to verify this token.');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <Spinner className="h-8 w-8 text-brand" />
        <p className="mt-3 text-sm text-slate-500">Verifying your email…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-6">
        <Brand />
      </div>

      <Card className="w-full max-w-md p-6 sm:p-8">
        {status === 'verified' ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Email verified</h1>
            <p className="mt-1 text-sm text-slate-500">{message ?? 'Your email address is confirmed.'}</p>
            <Link
              to="/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
            >
              Log in to your workspace
            </Link>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-secondary">
              <MailCheck className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Check your email</h1>
            <p className="mt-1 text-sm text-slate-500">
              {state.justSent
                ? `We sent a verification link to ${emailFromUrl || 'your inbox'}. Open it to activate your account.`
                : 'Open the verification link we emailed you to activate your account.'}
            </p>
            {state.justSent && state.emailDelivered === false && (
              <p className="mt-3 text-xs text-amber-600">
                No mail provider is configured in this environment, so the message was logged instead of sent.
                Use the link below to continue.
              </p>
            )}

            {error && (
              <div className="mt-4">
                <Alert>{error}</Alert>
              </div>
            )}
            {resentMessage && (
              <div className="mt-4">
                <Alert variant="success">{resentMessage}</Alert>
              </div>
            )}

            {devToken && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold">Development verification link</p>
                <p className="mt-1 break-all">Token: {devToken}</p>
                <button
                  type="button"
                  onClick={handleVerifyNow}
                  className="mt-2 font-medium text-brand hover:underline"
                >
                  Verify this account now
                </button>
              </div>
            )}

            <form onSubmit={handleResend} className="mt-6 space-y-4">
              <Field label="Email" htmlFor="email" hint="Didn't get it? We can send another link.">
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
              <Button type="submit" loading={resending} variant="secondary" className="w-full">
                Resend verification email
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already verified?{' '}
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

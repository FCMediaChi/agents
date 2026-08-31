import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }
    api.auth.verify(token)
      .then((r) => { setStatus('success'); setMessage(r.message); })
      .catch((e) => { setStatus('error'); setMessage(e.message || 'Invalid or expired link.'); });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-[#1A9EF2] mx-auto" />
            <p className="text-slate-600 text-sm">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-bold text-slate-900">Email Verified!</h1>
            <p className="text-slate-500 text-sm">{message}</p>
            <Link to="/login" className="inline-block px-6 py-2.5 rounded-xl font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] text-sm">Sign In</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-slate-900">Verification Failed</h1>
            <p className="text-slate-500 text-sm">{message}</p>
            <Link to="/login" className="inline-block px-6 py-2.5 rounded-xl font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm">Back to Sign In</Link>
          </>
        )}
      </div>
    </div>
  );
}

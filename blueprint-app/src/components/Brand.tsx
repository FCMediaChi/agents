import { Link } from 'react-router-dom';
import { LayoutTemplate } from 'lucide-react';
import { APP_NAME } from '../lib/constants';

/** Nuria Website Blueprint wordmark — shared by the landing and auth pages. */
export default function Brand({ size = 'md', to = '/' }: { size?: 'sm' | 'md'; to?: string }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const text = size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <Link to={to} className="flex items-center gap-2">
      <span className={`flex ${box} items-center justify-center rounded-lg bg-brand text-white`}>
        <LayoutTemplate className={icon} />
      </span>
      <span className={`${text} font-semibold text-slate-800`}>{APP_NAME}</span>
    </Link>
  );
}

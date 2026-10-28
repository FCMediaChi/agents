import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import Brand from './Brand';
import { APP_NAME } from '../lib/constants';

const navItems = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Brand size="sm" to="/dashboard" />
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-light text-brand-secondary' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-700">{user?.email}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{user?.subscription_tier ?? 'FREE'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
        <nav className="flex gap-1 border-t border-slate-100 px-4 py-1.5 sm:hidden">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-light text-brand-secondary' : 'text-slate-600'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
        {APP_NAME} — by First Creation Media.
      </footer>
    </div>
  );
}

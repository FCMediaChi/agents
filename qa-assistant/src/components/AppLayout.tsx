import { type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ClipboardCheck, LayoutDashboard, FolderKanban, Plus, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button } from './ui';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

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
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-slate-800">Nuria QA</span>
          </Link>

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
            <Link to="/projects/new">
              <Button variant="primary" className="hidden sm:inline-flex">
                <Plus className="h-4 w-4" />
                New QA Review
              </Button>
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-700">{user?.email}</p>
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

        {/* Mobile nav */}
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
          <Link to="/projects/new" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand">
            <Plus className="h-4 w-4" />
            New
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

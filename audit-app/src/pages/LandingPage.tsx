import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Accessibility,
  Palette,
  TrendingUp,
  Smartphone,
  Compass,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const dimensions = [
  { icon: Accessibility, title: 'Accessibility', text: 'Catch issues that keep visitors — and assistive tech — from using your site.' },
  { icon: Palette, title: 'Branding', text: 'Check the consistency of your logo, colors, and messaging.' },
  { icon: TrendingUp, title: 'Conversion', text: 'Spot friction in the path from visitor to customer.' },
  { icon: Smartphone, title: 'Mobile', text: 'Verify the experience holds up on smaller screens.' },
  { icon: Compass, title: 'Navigation', text: 'Find broken links and confusing site structure.' },
  { icon: ShieldCheck, title: 'Trust', text: 'Identify missing trust signals like contact info and social proof.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const primaryCta = user ? '/dashboard' : '/signup';
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">Nuria Website Audit</span>
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Log in
              </Link>
              <Link to="/signup" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          A clear, scored audit of your live website.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Nuria Website Audit analyzes your site across design, UX, accessibility, SEO, mobile, and
          conversion — and turns the results into an actionable report.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={primaryCta}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Start a website audit
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#dimensions"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Dimensions */}
      <section id="dimensions" className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            One audit, every angle that matters
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-600">
            Each audit is broken into scored dimensions so you know exactly where to focus.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dimensions.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-secondary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold">Ready to see your website clearly?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Run your first audit and get a scored, prioritized report.
          </p>
          <Link
            to={primaryCta}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Start a website audit
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <p>Nuria Website Audit — by First Creation Media.</p>
        <p className="mt-1">An analytical aid, not a formal accessibility certification or legal compliance determination.</p>
      </footer>
    </div>
  );
}

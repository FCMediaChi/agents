import { Link } from 'react-router-dom';
import { ClipboardCheck, ListChecks, Gauge, FileText, ArrowRight, ShieldCheck, Layers, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';

const capabilities = [
  { icon: ListChecks, title: 'Structured QA checklist', text: 'Work through a comprehensive, categorized checklist across design, UX, content, accessibility, SEO, and launch readiness.' },
  { icon: Gauge, title: 'Launch readiness scoring', text: 'A transparent QA Readiness Score and clear launch gates so nothing critical slips through.' },
  { icon: Layers, title: 'Repeatable QA runs', text: 'Run multiple reviews per project, track fixes, and compare results before and after revisions.' },
  { icon: FileText, title: 'Professional reports', text: 'Generate organized launch reports to share with clients and your team.' },
  { icon: ShieldCheck, title: 'Launch blockers surfaced', text: 'Critical and high-severity issues are prioritized automatically so you know what must be fixed first.' },
  { icon: Sparkles, title: 'AI-assisted fixes', text: 'Get plain-language explanations and remediation suggestions — clearly labeled as AI-assisted.' },
];

const steps = [
  { n: '1', title: 'Create a project', text: 'Enter the website name, URL, platform, and type.' },
  { n: '2', title: 'Work the checklist', text: 'Mark each item pass, fail, needs review, or not applicable — with your own notes.' },
  { n: '3', title: 'Resolve issues', text: 'Prioritize launch blockers and record fixes as you go.' },
  { n: '4', title: 'Generate your report', text: 'Get a clear launch-readiness summary to share.' },
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
          <span className="text-sm font-semibold">Nuria Design QA Assistant</span>
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
          A smarter final check before your website goes live.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Run a structured website QA review, uncover launch blockers, organize fixes, and turn your
          final website check into a repeatable professional process.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to={primaryCta} className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/90">
            Start a QA Review
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#how" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            See How It Works
          </a>
        </div>
      </section>

      {/* Capabilities */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Built for professional website QA</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            Designed for freelance designers, developers, and agencies — regardless of which platform
            the site is built on.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-secondary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-4">
            {steps.map(({ n, title, text }) => (
              <div key={n} className="rounded-xl border border-slate-200 p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-brand-secondary py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ship with confidence.</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-light">
            Start your first structured QA review and catch launch blockers before your clients do.
          </p>
          <Link to={primaryCta} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-secondary hover:bg-brand-light">
            Start a QA Review
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
        <p>Nuria Design QA Assistant — by First Creation Media.</p>
        <p className="mt-1">A QA aid, not a formal accessibility certification or legal compliance determination.</p>
      </footer>
    </div>
  );
}

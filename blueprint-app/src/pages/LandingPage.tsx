import { Link } from 'react-router-dom';
import {
  LayoutTemplate,
  Network,
  FileText,
  MessageSquareText,
  SquareDashedMousePointer,
  FileCheck2,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { APP_NAME, DELIVERABLES, TIERS } from '../lib/constants';

const deliverableIcons = [Network, FileText, MessageSquareText, SquareDashedMousePointer, FileCheck2];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <LayoutTemplate className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">{APP_NAME}</span>
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
                Start free
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center rounded-full bg-brand-light/60 px-3 py-1 text-xs font-semibold text-brand-secondary">
          Website planning, in minutes
        </span>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
          From a rough idea to a deliverable-ready website plan.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          {APP_NAME} turns a rough idea into a sitemap, page outlines, content questionnaires,
          wireframes, and a client-ready proposal — so you can move from discovery to proposal fast.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={user ? '/dashboard' : '/signup'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/90"
          >
            {user ? 'Open your workspace' : 'Start free — no card needed'}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#deliverables"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            See what you get
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">Free tier includes one project, for as long as you need it.</p>
      </section>

      {/* Deliverables */}
      <section id="deliverables" className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Five deliverables, one project plan</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-600">
            Each part of the plan builds on the last, so the proposal writes itself.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DELIVERABLES.map(({ key, title, text }, index) => {
              const Icon = deliverableIcons[index] ?? Network;
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-secondary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Simple pricing</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-600">
            Start free. Upgrade when you're planning for clients.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`flex flex-col rounded-2xl border p-6 ${
                  tier.highlighted ? 'border-brand bg-brand-light/20 shadow-sm' : 'border-slate-200 bg-white'
                }`}
              >
                <h3 className="text-base font-semibold text-slate-900">{tier.name}</h3>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {tier.price}
                  {tier.cadence && <span className="text-sm font-medium text-slate-500">{tier.cadence}</span>}
                </p>
                <p className="mt-2 text-sm text-slate-600">{tier.description}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={tier.cta.to}
                  className={`mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${
                    tier.highlighted
                      ? 'bg-brand text-white hover:bg-brand/90'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tier.cta.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <p>{APP_NAME} — by First Creation Media.</p>
      </footer>
    </div>
  );
}

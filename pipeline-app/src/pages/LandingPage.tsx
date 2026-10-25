import { Link } from 'react-router-dom';
import { Send, FileText, Mail, Building2, ArrowRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { TRIAL_DAYS } from '../lib/constants';

const features = [
  { icon: FileText, title: 'Case Study Generator', text: 'Upload screenshots and results, and get a polished client story you can share.' },
  { icon: Mail, title: 'Cold Pitch Builder', text: 'Enter a prospect URL and get a quick teardown plus a ready-to-send cold email.' },
  { icon: Building2, title: 'Agency Profile', text: 'Keep your services and positioning in one place so every pitch stays on-brand.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Send className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">Nuria Client Pipeline</span>
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
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Turn prospects into clients with a repeatable outbound pipeline.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Nuria Client Pipeline helps you tell a compelling story with case studies and pitch the
          right prospects with a cold email written for their site.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Start your {TRIAL_DAYS}-day free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Everything you need to pitch with confidence
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-600">
            A focused outbound toolkit for freelancers and small agencies.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
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
          <h2 className="text-2xl font-semibold">Ready to fill your pipeline?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Start your {TRIAL_DAYS}-day free trial and create your first case study.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Start free trial
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <p>Nuria Client Pipeline — by First Creation Media.</p>
        <p className="mt-1">Case studies and pitches are generated as drafts for your review before sending.</p>
      </footer>
    </div>
  );
}

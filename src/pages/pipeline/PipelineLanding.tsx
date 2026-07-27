import { useState } from 'react';
import { FileText, Send, CheckCircle, ChevronDown, ChevronUp, Sparkles, Clock } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: "What is Nuria Client Pipeline?",
    a: "Nuria Client Pipeline is a tool built for agencies and freelancers to generate polished case studies and craft compelling cold pitches — saving hours of manual writing and helping you win more clients."
  },
  {
    q: "How does the free trial work?",
    a: "You get 7 full days of access to all features. No credit card required. Use it to generate case studies and cold pitches, and cancel anytime before the trial ends."
  },
  {
    q: "Can I export my case studies?",
    a: "Yes! All plans include export to PDF and shareable links. Agency plans also include white-label options to remove Nuria branding."
  },
  {
    q: "What happens after my trial?",
    a: "Your data is saved. You can upgrade to any paid plan to continue using the tools. If you don't upgrade, you'll retain read-only access to your generated content."
  },
  {
    q: "Is this separate from Nuria Website Blueprint?",
    a: "Yes — Nuria Client Pipeline is a standalone product focused on agency sales enablement. You can use it independently or alongside the Blueprint tool."
  },
];

export default function PipelineLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
              Nuria Client Pipeline
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#1A9EF2] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#1A9EF2] transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-[#1A9EF2] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#1A9EF2] transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="/pipeline/login" className="text-sm font-semibold text-[#1A9EF2] hover:text-[#4551D3] transition-colors">
              Sign In
            </a>
            <a href="/pipeline/register" className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-md hover:shadow-lg">
              Start Free Trial
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-28 bg-gradient-to-b from-slate-50 to-white">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#C3E8FF]/30 to-[#6DC7FF]/10 blur-3xl -translate-y-1/2 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C3E8FF]/60 text-[#4551D3] text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-[#1A9EF2]" />
              New — Nuria Client Pipeline
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Win More Clients with{' '}
              <span className="bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
                Professional Case Studies & Pitches
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto">
              Generate polished case studies and compelling cold pitches in minutes — so you can spend less time writing and more time closing deals.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a href="/pipeline/register" className="px-8 py-3.5 rounded-xl text-base font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-lg hover:shadow-xl shadow-[#1A9EF2]/20 w-full sm:w-auto text-center">
                Start 7-Day Free Trial
              </a>
              <a href="#features" className="px-8 py-3.5 rounded-xl text-base font-semibold border-2 border-slate-200 text-slate-700 hover:border-[#1A9EF2] hover:text-[#1A9EF2] transition-all w-full sm:w-auto text-center">
                See Features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Two Powerful Tools, One Pipeline
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Everything you need to showcase your work and reach new prospects.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Case Study Generator */}
            <div className="group relative p-8 rounded-2xl border border-slate-200 bg-white hover:border-[#1A9EF2]/40 hover:shadow-xl hover:shadow-[#1A9EF2]/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[#C3E8FF]/40 flex items-center justify-center mb-5 group-hover:bg-[#C3E8FF]/70 transition-colors">
                <FileText className="w-6 h-6 text-[#1A9EF2]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Case Study Generator</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Turn client results into polished, professional case studies in minutes. Fill in the details and we generate a beautifully formatted PDF ready to share with prospects.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> Structured templates</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> PDF export</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> White-label branding</li>
              </ul>
            </div>

            {/* Cold Pitch Builder */}
            <div className="group relative p-8 rounded-2xl border border-slate-200 bg-white hover:border-[#1A9EF2]/40 hover:shadow-xl hover:shadow-[#1A9EF2]/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[#C3E8FF]/40 flex items-center justify-center mb-5 group-hover:bg-[#C3E8FF]/70 transition-colors">
                <Send className="w-6 h-6 text-[#1A9EF2]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Cold Pitch Builder</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Craft personalized outreach messages that convert. Describe the prospect's pain points and we generate tailored pitch emails proven to get responses.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> AI-assisted drafting</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> Industry-specific tone</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> Save & reuse templates</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Get started in three simple steps.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Sign Up & Start Trial', desc: 'Create your free account and get instant access to all Pipeline features for 7 days — no credit card required.' },
              { step: '2', title: 'Set Up Your Agency', desc: 'Tell us about your agency — name, niche, and website. We use this to personalize your case studies and pitches.' },
              { step: '3', title: 'Generate & Close Deals', desc: 'Create case studies from past wins, build cold pitches for prospects, and start winning more clients.' },
            ].map((item, i) => (
              <div key={i} className="relative text-center p-6">
                <div className="w-14 h-14 rounded-full bg-[#1A9EF2] text-white flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-[#1A9EF2]/20">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Start with a 7-day free trial. Upgrade when you're ready.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { name: 'Free Trial', price: '$0', period: '7 days', features: ['Full access to all features', 'Up to 3 case studies', 'Up to 3 cold pitches', 'PDF export'], cta: 'Start Free', href: '/pipeline/register', featured: false },
              { name: 'Solo', price: 'TBD', period: '/mo', features: ['Everything in Free', 'Unlimited case studies', 'Unlimited cold pitches', 'Custom branding'], cta: 'Coming Soon', href: '#', featured: false },
              { name: 'Team', price: 'TBD', period: '/mo', features: ['Everything in Solo', 'Up to 5 team members', 'Shared templates', 'Priority support'], cta: 'Coming Soon', href: '#', featured: true },
              { name: 'Agency', price: 'TBD', period: '/mo', features: ['Everything in Team', 'Unlimited team members', 'White-label exports', 'API access'], cta: 'Coming Soon', href: '#', featured: false },
            ].map((plan, i) => (
              <div key={i} className={`relative p-6 rounded-2xl border-2 ${plan.featured ? 'border-[#1A9EF2] shadow-xl shadow-[#1A9EF2]/10' : 'border-slate-200'} bg-white flex flex-col`}>
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full bg-[#1A9EF2] text-white text-xs font-semibold">
                    Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>
                  <span className="text-slate-400 text-sm ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href={plan.href} className={`block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all ${plan.featured ? 'bg-[#1A9EF2] text-white hover:bg-[#4551D3] shadow-md' : plan.name === 'Free Trial' ? 'bg-[#1A9EF2] text-white hover:bg-[#4551D3]' : 'bg-slate-100 text-slate-500 cursor-not-allowed'}`}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trial urgency bar */}
      <section className="py-12 bg-gradient-to-r from-[#1A9EF2] to-[#4551D3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="flex items-center gap-3 text-white">
              <Clock className="w-6 h-6" />
              <span className="text-lg font-semibold">7-Day Free Trial — No Credit Card Required</span>
            </div>
            <a href="/pipeline/register" className="px-6 py-3 rounded-xl bg-white text-[#1A9EF2] font-semibold hover:bg-slate-100 transition-all shadow-md">
              Get Started Free
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-slate-900 pr-4">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-slate-600 text-sm leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} First Creation Media. Nuria Client Pipeline is a product of First Creation Media.
          </p>
        </div>
      </footer>
    </div>
  );
}

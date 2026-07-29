import { useState } from 'react';
import { useTitle } from '../../hooks/useTitle';
import { FileText, Send, CheckCircle, ChevronDown, ChevronUp, Sparkles, Clock, Upload, Search, PenTool } from 'lucide-react';

const FAQ_ITEMS = [
  { q: "What is Nuria Client Pipeline?", a: "Nuria Client Pipeline helps agencies scale outbound sales by automatically identifying website flaws on target leads and matching them with data-backed proof — so you can book more high-ticket meetings without manual prospecting." },
  { q: "How does the free trial work?", a: "You get 7 full days of access to all features. No credit card required. Generate case studies and cold pitches, and cancel anytime before the trial ends." },
  { q: "Can I export my case studies and pitches?", a: "Yes! All plans include PDF export and shareable links. Agency plans also include white-label options to remove Nuria branding." },
  { q: "What happens after my trial?", a: "Your data is saved. You can upgrade to any paid plan to continue using the tools. If you don't upgrade, you'll retain read-only access to your generated content." },
  { q: "Is this separate from Nuria Website Blueprint?", a: "Yes — Nuria Client Pipeline is a standalone product focused on agency sales enablement. You can use it independently or alongside the Blueprint tool." },
];

const HOW_IT_WORKS = [
  { step: '1', icon: Upload, title: 'Upload Client Wins', desc: 'Upload screenshots, input traffic and revenue data, and link the old site — we capture the proof of your impact.' },
  { step: '2', icon: Search, title: 'Analyze Prospects', desc: 'Enter a prospect URL and our AI analyzes speed, layout, SEO, and accessibility flaws on their current website.' },
  { step: '3', icon: PenTool, title: 'Generate & Close', desc: 'Get a polished case study and a custom cold email script referencing the prospect\'s real problems — ready to send.' },
];

export default function PipelineLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useTitle('Nuria Client Pipeline | Nuria AI');
  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">Nuria Client Pipeline</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#1A9EF2] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#1A9EF2] transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-[#1A9EF2] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#1A9EF2] transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="/pipeline/login" className="text-sm font-semibold text-[#1A9EF2] hover:text-[#4551D3] transition-colors">Sign In</a>
            <a href="/pipeline/register" className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-md hover:shadow-lg">Start Free Trial</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-28 bg-gradient-to-b from-slate-50 to-white">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#C3E8FF]/30 to-[#6DC7FF]/10 blur-3xl -translate-y-1/2 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C3E8FF]/60 text-[#4551D3] text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-[#1A9EF2]" /> New — Nuria Client Pipeline
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Scale outbound sales.{' '}
              <span className="bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">Eliminate manual prospecting.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto">
              Automatically identify website flaws on target leads and match them with data-backed proof to book high-ticket meetings.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a href="/pipeline/register" className="px-8 py-3.5 rounded-xl text-base font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-lg hover:shadow-xl shadow-[#1A9EF2]/20 w-full sm:w-auto text-center">
                Start Free Trial
              </a>
              <a href="#features" className="px-8 py-3.5 rounded-xl text-base font-semibold border-2 border-slate-200 text-slate-700 hover:border-[#1A9EF2] hover:text-[#1A9EF2] transition-all w-full sm:w-auto text-center">
                See Features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Two Powerful Tools, One Pipeline</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Everything you need to showcase your work and reach new prospects.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="group relative p-8 rounded-2xl border border-slate-200 bg-white hover:border-[#1A9EF2]/40 hover:shadow-xl hover:shadow-[#1A9EF2]/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[#C3E8FF]/40 flex items-center justify-center mb-5 group-hover:bg-[#C3E8FF]/70 transition-colors">
                <FileText className="w-6 h-6 text-[#1A9EF2]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Case Study Generator</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Upload screenshots, input traffic and revenue data, and link the old site — our AI generates a narrative case study proving your impact.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> Upload screenshots & data</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> AI-generated narrative</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> PDF export & white-label</li>
              </ul>
            </div>
            <div className="group relative p-8 rounded-2xl border border-slate-200 bg-white hover:border-[#1A9EF2]/40 hover:shadow-xl hover:shadow-[#1A9EF2]/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[#C3E8FF]/40 flex items-center justify-center mb-5 group-hover:bg-[#C3E8FF]/70 transition-colors">
                <Send className="w-6 h-6 text-[#1A9EF2]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Cold Pitch Builder</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Enter a prospect's URL — our AI analyzes speed, layout, and SEO flaws and generates a custom teardown report with a cold email script.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> Enter prospect URL</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> Auto-detected flaws</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0" /> Custom cold email script</li>
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
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Get started in three simple steps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} className="relative text-center p-6">
                <div className="w-14 h-14 rounded-full bg-[#1A9EF2] text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#1A9EF2]/20">
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="absolute top-4 left-[calc(50%+2.5rem)] w-6 h-6 rounded-full bg-[#C3E8FF] text-[#4551D3] text-xs font-bold flex items-center justify-center hidden md:flex">
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
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Start with a 7-day free trial. Then choose a plan.</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: 'Free Trial',
                price: '$0',
                period: '7 days',
                features: ['Full access to all features', 'Up to 3 case studies', 'Up to 3 cold pitches', 'PDF export'],
                cta: 'Start Free',
                href: '/pipeline/register',
                featured: false,
              },
              {
                name: 'Solo',
                price: '$79',
                period: '/mo',
                yearly: '$758/yr',
                yearlyHref: 'https://buy.stripe.com/7sY14n8QAgvO4Is4DAfAc0e',
                features: ['Case study generator', 'Cold pitch builder', '10 case studies/month', '20 pitches/month', 'Email support'],
                cta: 'Get Started',
                href: 'https://buy.stripe.com/3cI9AT5Eoa7qej20nkfAc0d',
                featured: false,
              },
              {
                name: 'Team',
                price: '$199',
                period: '/mo',
                yearly: '$1,910/yr',
                yearlyHref: 'https://buy.stripe.com/8x200j5EodjCcaU2vsfAc0g',
                features: ['Everything in Solo', 'Unlimited case studies', 'Unlimited pitches', 'Team collaboration', 'Priority support'],
                cta: 'Get Started',
                href: 'https://buy.stripe.com/6oUbJ1aYIcfya2M3zwfAc0f',
                featured: true,
              },
              {
                name: 'Agency',
                price: 'Call for pricing',
                period: '',
                features: ['Everything in Team', 'White-labeling', 'API access', 'Custom yearly pricing', 'Dedicated support'],
                cta: 'Contact Us',
                href: '#',
                featured: false,
              },
            ].map((plan: any, i) => (
              <div key={i} className={`relative p-6 rounded-2xl border-2 ${plan.featured ? 'border-[#1A9EF2] shadow-xl shadow-[#1A9EF2]/10' : 'border-slate-200'} bg-white flex flex-col`}>
                {plan.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full bg-[#1A9EF2] text-white text-xs font-semibold">Popular</div>}
                <h3 className="text-lg font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="mb-1">
                  <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>
                  <span className="text-slate-400 text-sm ml-1">{plan.period}</span>
                </div>
                {plan.yearly && (
                  <p className="text-xs text-slate-400 mb-3">
                    or{' '}
                    {plan.yearlyCta ? (
                      <a href={plan.href} className="text-[#1A9EF2] font-medium underline hover:text-[#4551D3] transition-colors">
                        {plan.yearlyCta}
                      </a>
                    ) : plan.yearlyHref ? (
                      <a href={plan.yearlyHref} className="text-slate-500 underline hover:text-[#1A9EF2] transition-colors">
                        {plan.yearly}
                      </a>
                    ) : (
                      <span className="text-slate-500">{plan.yearly}</span>
                    )}
                    {!plan.yearlyCta && !plan.yearlyHref && ' when billed annually'}
                  </p>
                )}
                {!plan.yearly && <div className="mb-4"></div>}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f: string, j: number) => (<li key={j} className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle className="w-4 h-4 text-[#1A9EF2] flex-shrink-0 mt-0.5" />{f}</li>))}
                </ul>
                <a href={plan.href} className={`block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all ${plan.featured ? 'bg-[#1A9EF2] text-white hover:bg-[#4551D3] shadow-md' : plan.name === 'Free Trial' ? 'bg-[#1A9EF2] text-white hover:bg-[#4551D3]' : 'bg-[#1A9EF2] text-white hover:bg-[#4551D3]'}`}>{plan.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bar */}
      <section className="py-12 bg-gradient-to-r from-[#1A9EF2] to-[#4551D3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="flex items-center gap-3 text-white"><Clock className="w-6 h-6" /><span className="text-lg font-semibold">7-Day Free Trial — No Credit Card Required</span></div>
            <a href="/pipeline/register" className="px-6 py-3 rounded-xl bg-white text-[#1A9EF2] font-semibold hover:bg-slate-100 transition-all shadow-md">Start Free Trial</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2></div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-semibold text-slate-900 pr-4">{item.q}</span>
                  {openFaq === i ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                </button>
                {openFaq === i && <div className="px-5 pb-5 text-slate-600 text-sm leading-relaxed">{item.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} First Creation Media. Nuria Client Pipeline is a product of First Creation Media.</p>
        </div>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';
import {
  Compass,
  HelpCircle,
  Layout,
  Search,
  Target,
  TrendingUp,
  Mail,
  MessageSquare,
  BookOpen,
  ChevronDown,
  ArrowRight,
  Check,
} from 'lucide-react';

const APP_GUIDES = [
  {
    id: 'blueprint',
    name: 'Nuria Website Blueprint',
    icon: <Compass className="w-6 h-6" />,
    color: '#1A9EF2',
    description: 'All-in-one website planning tool that generates sitemaps, page outlines, content questionnaires, wireframes, and project proposals.',
    gettingStarted: [
      { step: 1, title: 'Create your first project', body: 'Click "New Project" from your dashboard and give it a name. Your free tier includes one active project.' },
      { step: 2, title: 'Build your sitemap', body: 'Add pages hierarchically — Home, About, Services, Contact. Drag to reorder. Each page gets a type (homepage, about, services, contact, pricing) that determines the auto-generated content questionnaire.' },
      { step: 3, title: 'Set page outlines & objectives', body: 'For each page, write a description, define the primary goal (e.g., "Generate leads", "Educate visitors"), add specific design notes, and attach any reference URLs.' },
      { step: 4, title: 'Complete content questionnaires', body: 'Each page type generates a tailored set of copy questions. Send the client-facing survey link (paid plans) or fill them in yourself.' },
      { step: 5, title: 'Design wireframe blocks', body: 'Add modular layout blocks (hero, features, testimonials, CTA, footer) per page. Arrange them visually to define page flow.' },
      { step: 6, title: 'Export your proposal', body: 'On paid plans, compile everything into a branded PDF proposal with your logo, colors, sitemap tree, page briefs, wireframes, and pricing estimates.' },
    ],
    keyFeatures: [
      'Hierarchical sitemap builder with drag-and-drop reordering',
      'Page-type-specific content questionnaires (homepage, about, services, contact, pricing)',
      'Visual wireframe block canvas with 50+ modular sections',
      'Custom agency branding (logo, primary & secondary colors)',
      'Vector PDF proposal export with project cost estimates',
      'Client-facing portal for direct survey responses (Team plan)',
      'Interactive HTML exports and Google Docs/Word exports (Team plan)',
    ],
    tips: [
      'Start with the sitemap — a clear structure makes everything else flow naturally.',
      'Use the "Interactive Demo" on the landing page to test-drive the tool before signing up.',
      'On Team plans, invite clients to fill in questionnaires directly — saves hours of back-and-forth.',
      'Save your branding colors and logo in Account Settings so every export is pre-branded.',
    ],
  },
  {
    id: 'audit',
    name: 'Nuria Website Audit',
    icon: <Search className="w-6 h-6" />,
    color: '#4551D3',
    description: 'Automated website audit tool that analyzes performance, SEO, accessibility, mobile-friendliness, and more.',
    gettingStarted: [
      { step: 1, title: 'Enter a website URL', body: 'Visit the Audit page and enter any public URL. The free tier audits the homepage only. Paid plans unlock full-site crawling.' },
      { step: 2, title: 'Review the report', body: 'Your audit covers performance scores (Core Web Vitals), SEO fundamentals (meta tags, headings, sitemap), accessibility checks, mobile responsiveness, and security headers.' },
      { step: 3, title: 'Share or export findings', body: 'Download the report as a PDF or share a read-only link with your client or team. Paid plans allow white-labeling and custom report branding.' },
      { step: 4, title: 'Track improvements over time', body: 'Re-audit the same site periodically to track improvements. Team and Agency plans include historical report storage.' },
    ],
    keyFeatures: [
      'Homepage audit free — no sign-up required',
      'Full-site crawl on single-use ($29) and subscription plans',
      'Performance scoring with Core Web Vitals breakdown',
      'SEO analysis: meta tags, heading structure, Open Graph, sitemap',
      'Mobile responsiveness and touch-target accessibility checks',
      'Security header analysis (CSP, HSTS, X-Frame-Options)',
      'Downloadable PDF reports with actionable fix recommendations',
    ],
    tips: [
      'Run a free homepage audit first — it gives you a solid preview of what the full report covers.',
      'Use the audit report as a sales tool — send prospects a free audit to demonstrate value before pitching.',
      'For e-commerce sites, pay close attention to the mobile responsiveness score — it directly impacts conversions.',
      'The single-use ($29) option is great for one-off client audits without a subscription commitment.',
    ],
  },
  {
    id: 'pipeline',
    name: 'Nuria Client Pipeline',
    icon: <Target className="w-6 h-6" />,
    color: '#6DC7FF',
    description: 'Outbound sales and prospecting toolkit with AI-powered case study generation and cold pitch email builder.',
    gettingStarted: [
      { step: 1, title: 'Set up your agency profile', body: 'After registering, complete the onboarding flow — add your agency name, website, services, and target industries.' },
      { step: 2, title: 'Generate a case study', body: 'Upload before/after screenshots of a client project plus traffic and revenue data. The AI generates a narrative case study with problem-solution-results structure and key metrics.' },
      { step: 3, title: 'Build a cold pitch', body: 'Enter a prospect\'s website URL. The tool runs a quick teardown analysis and generates a personalized cold email script highlighting specific issues and how you can fix them.' },
      { step: 4, title: 'Track your outreach', body: 'Manage your pitches from the dashboard — track status, copy email scripts, and log meetings booked.' },
    ],
    keyFeatures: [
      'AI-generated narrative case studies from screenshots + data',
      'Prospect website teardown with specific improvement recommendations',
      'Personalized cold email scripts (subject, body, signature)',
      'Agency profile with service and industry targeting',
      'Dashboard with stats: case studies, pitches, meetings booked',
      'Free 7-day trial on all subscription tiers',
    ],
    tips: [
      'Use real client data for case studies — specific before/after metrics are far more compelling than general claims.',
      'Customize the AI-generated cold email before sending — add a personal detail about the prospect\'s business.',
      'Target the "Cold Pitch Builder" at websites that clearly need your specific services — relevance beats volume.',
      'Save your best-performing cold email scripts as templates for future use.',
    ],
  },
];

const FAQS = [
  {
    q: 'Can I use multiple Nuria apps together?',
    a: 'Yes, they are designed to work as a suite. For example: audit a prospect\'s site with Nuria Website Audit, use Nuria Website Blueprint to plan their new site, and send a personalized pitch through Nuria Client Pipeline.',
  },
  {
    q: 'Do I need separate accounts for each app?',
    a: 'Currently each app has its own login, but we are building a unified Nuria AI account that will connect all three products under a single sign-on.',
  },
  {
    q: 'What happens when I hit my project limit on the Blueprint?',
    a: 'You can archive completed projects to free up a slot, or upgrade to a higher tier. Your data is never deleted — archived projects can be restored anytime.',
  },
  {
    q: 'How accurate is the Website Audit?',
    a: 'The audit uses Lighthouse-based performance scoring and real browser rendering for mobile checks. SEO analysis covers on-page fundamentals. It is accurate for identifying actionable issues but is not a replacement for a full manual SEO audit.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. All plans are month-to-month or annual with no long-term contracts. Cancel from your account settings and your access continues until the end of the billing period.',
  },
  {
    q: 'Is there a refund policy?',
    a: 'We do not offer refunds on monthly subscriptions, but you can cancel anytime. Annual plans have a 14-day refund window from the date of purchase.',
  },
];

export default function SupportPage() {
  useTitle('Support | Nuria AI');
  const [activeApp, setActiveApp] = useState('blueprint');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currentApp = APP_GUIDES.find((a) => a.id === activeApp) || APP_GUIDES[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A9EF2] to-[#4551D3] flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
              Nuria AI
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-[#1A9EF2] transition-colors">Home</Link>
            <a href="#guides" className="hover:text-[#1A9EF2] transition-colors">App Guides</a>
            <a href="#faq" className="hover:text-[#1A9EF2] transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-[#1A9EF2] transition-colors">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-[#1A9EF2] hover:text-[#4551D3] transition-colors"
            >
              Sign In
            </Link>
            <a
              href="https://nuria.firstcreationmedia.com/#products"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-md"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white py-16 lg:py-20 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C3E8FF]/60 text-[#4551D3] text-sm font-semibold mb-6">
            <HelpCircle className="w-4 h-4 text-[#1A9EF2]" />
            Help & Support Center
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Everything you need to<br />
            <span className="bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
              get the most out of Nuria AI
            </span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Step-by-step guides, tips, and answers for all three Nuria products. Whether you're planning websites, auditing sites, or pitching clients — we've got you covered.
          </p>
        </div>
      </section>

      {/* App Guide Tabs */}
      <section id="guides" className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab Selector */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {APP_GUIDES.map((app) => (
              <button
                key={app.id}
                onClick={() => setActiveApp(app.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  activeApp === app.id
                    ? 'bg-white text-slate-900 border-slate-300 shadow-md'
                    : 'bg-white/60 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <span style={{ color: activeApp === app.id ? app.color : undefined }}>{app.icon}</span>
                {app.name}
              </button>
            ))}
          </div>

          {/* Active App Guide */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* App Header */}
            <div className="p-6 sm:p-8 border-b border-slate-100" style={{ borderLeftWidth: '4px', borderLeftColor: currentApp.color }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: currentApp.color + '15', color: currentApp.color }}>
                  {currentApp.icon}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{currentApp.name}</h2>
              </div>
              <p className="text-slate-600 leading-relaxed max-w-3xl">{currentApp.description}</p>
            </div>

            <div className="p-6 sm:p-8 space-y-10">
              {/* Getting Started */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-5">
                  <BookOpen className="w-5 h-5" style={{ color: currentApp.color }} />
                  Getting Started
                </h3>
                <div className="space-y-4">
                  {currentApp.gettingStarted.map((item) => (
                    <div key={item.step} className="flex gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: currentApp.color }}
                      >
                        {item.step}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">{item.title}</h4>
                        <p className="text-slate-600 text-sm leading-relaxed mt-0.5">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Features */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-5">
                  <Layout className="w-5 h-5" style={{ color: currentApp.color }} />
                  Key Features
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {currentApp.keyFeatures.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5 p-2.5 rounded-lg">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tips */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-5">
                  <TrendingUp className="w-5 h-5" style={{ color: currentApp.color }} />
                  Pro Tips
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {currentApp.tips.map((tip, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-700 leading-relaxed"
                      style={{ borderLeftWidth: '3px', borderLeftColor: currentApp.color }}
                    >
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
            <p className="text-slate-600 mt-2">Quick answers to common questions about the Nuria AI suite.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-sm pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C3E8FF]/60 text-[#4551D3] text-sm font-semibold mb-4">
            <MessageSquare className="w-4 h-4 text-[#1A9EF2]" />
            Still need help?
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4">We're here for you</h2>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto">
            Can't find what you're looking for? Reach out and our team will get back to you within one business day.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:support@nuria.firstcreationmedia.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-md"
            >
              <Mail className="w-4 h-4" />
              Email Support
            </a>
            <a
              href="https://nuria.firstcreationmedia.com/#products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all"
            >
              <ArrowRight className="w-4 h-4" />
              Get Started
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="flex justify-center items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A9EF2] to-[#4551D3] flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold">Nuria AI</span>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/support" className="hover:text-white transition-colors">Support</Link>
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
            © {new Date().getFullYear()} First Creation Media. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

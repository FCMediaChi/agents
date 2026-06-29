import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SitemapBuilderPage from './pages/SitemapBuilderPage'
import { 
  Compass, 
  Layers, 
  FileText, 
  HelpCircle, 
  Layout, 
  Check, 
  ArrowRight, 
  Users, 
  Sparkles, 
  Download, 
  Palette, 
  TrendingUp,
  CheckCircle2,
  Lock
} from 'lucide-react'

// Define the content questionnaires per page type
const QUESTIONNAIRE_TEMPLATES: Record<string, string[]> = {
  homepage: [
    "What is the main headline / value proposition?",
    "What are the top 3 action items visitors should take?",
    "Who is your primary target customer segment?"
  ],
  about: [
    "What is the founding story/mission statement of the business?",
    "What are your primary values/guarantees?",
    "Who are the key team members?"
  ],
  services: [
    "List the core services offered.",
    "What key benefits do your services provide over competitors?",
    "What testimonials or proof support these services?"
  ],
  contact: [
    "What contact details should be prominent (phone, email, address)?",
    "What details must be present in the contact form?",
    "What is the average expected response time?"
  ],
  pricing: [
    "What are the names and costs of each pricing tier?",
    "List the key features included in each tier.",
    "What is the refund policy or guarantee?"
  ]
}

// Define mock default sitemaps for the Interactive Simulator
const SIMULATOR_TEMPLATES = {
  ecommerce: [
    { id: '1', title: 'Home', type: 'homepage', description: 'Storefront highlighting featured categories, hot deals, and brand trust.', notes: 'Include slider, bestseller grid, and review carousel.' },
    { id: '2', title: 'Shop / Catalog', type: 'services', description: 'Grid of all products with filters, sorting, and pagination.', notes: 'Keep filters on sidebar (size, price, color).' },
    { id: '3', title: 'Product Details', type: 'services', description: 'Deep-dive page for a single item with gallery, specs, and add-to-cart.', notes: 'Place sticky buy button on mobile view.' },
    { id: '4', title: 'About Our Brand', type: 'about', description: 'Story of sourcing, sustainability, and team values.', notes: 'Include video background.' },
    { id: '5', title: 'Contact Support', type: 'contact', description: 'Order lookup and messaging form.', notes: 'Display FAQ accordion before the form.' }
  ],
  localbusiness: [
    { id: '1', title: 'Home', type: 'homepage', description: 'Service hook, service area map, booking CTA, and direct phone link.', notes: 'Show phone number big in the header.' },
    { id: '2', title: 'Our Services', type: 'services', description: 'Detailed breakdown of offerings, hourly rates, and service descriptions.', notes: 'Add interactive estimation slider if possible.' },
    { id: '3', title: 'Why Choose Us', type: 'about', description: 'Licenses, insurance proof, local roots, and customer reviews.', notes: 'Include badge logos of certifications.' },
    { id: '4', title: 'Book an Appointment', type: 'contact', description: 'Interactive booking calendar integration page.', notes: 'Embed Calendly or direct custom request form.' }
  ],
  saas: [
    { id: '1', title: 'Home', type: 'homepage', description: 'Software value prop, interactive product dashboard screenshot, and signup CTAs.', notes: 'Incorporate animated logos of famous clients.' },
    { id: '2', title: 'Features Deep Dive', type: 'services', description: 'Detailed list of core modules, integrations, and speed benefits.', notes: 'Show side-by-side comparison tables.' },
    { id: '3', title: 'Subscription Plans', type: 'pricing', description: 'Pricing tiers, FAQs, and enterprise custom quote CTAs.', notes: 'Highlight the annual plan toggle.' },
    // A simplified Contact path
    { id : '4', page_type: 'contact', title: 'Talk to Sales', description: 'Enterprise contact form and sales booking calendar.', goals: 'Enterprise lead capture', notes: 'Integrate with HubSpot CRM.' }
  ]
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LandingPage() {
  // States for interactive components
  const [activeSegment, setActiveSegment] = useState<"planners" | "explorers">("planners")
  const [simulatorCategory, setSimulatorCategory] = useState<"ecommerce" | "localbusiness" | "saas">("ecommerce")
  const [selectedSimPage, setSelectedSimPage] = useState<number>(0)
  
  // Custom branding colors state for proposal simulator
  const [brandPrimary, setBrandPrimary] = useState<string>("#1A9EF2")
  const [brandSecondary, setBrandSecondary] = useState<string>("#4551D3")
  const [brandingLogo, setBrandingLogo] = useState<string>("First Creation Media")
  const [brandLogoFile, setBrandLogoFile] = useState<string>("/logo-blue.png")
  const [isExported, setIsExported] = useState<boolean>(false)

  const activePages = SIMULATOR_TEMPLATES[simulatorCategory]
  const currentPage = activePages[selectedSimPage] || activePages[0]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-[#C3E8FF] selection:text-[#1A9EF2]">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-white shadow-md shadow-[#1A9EF2]/5 overflow-hidden p-1">
              <img src="/logo-blue.png" alt="First Creation Media" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
                TheBlueprint
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#C3E8FF] text-[#1A9EF2]">
                by First Creation Media
              </span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#1A9EF2] transition-colors">Features</a>
            <a href="#segments" className="hover:text-[#1A9EF2] transition-colors">Who is it for?</a>
            <a href="#simulator" className="hover:text-[#1A9EF2] transition-colors">Interactive Demo</a>
            <a href="#pricing" className="hover:text-[#1A9EF2] transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-4">
            <a 
              href="#pricing" 
              className="text-sm font-semibold text-[#1A9EF2] hover:text-[#4551D3] transition-colors"
            >
              Sign In
            </a>
            <a 
              href="/register" 
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-md hover:shadow-lg shadow-[#1A9EF2]/10"
            >
              Start Free
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32 bg-white">
        {/* Colorful background blobs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#C3E8FF]/30 to-[#6DC7FF]/10 blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#4551D3]/5 to-[#1A9EF2]/5 blur-3xl translate-y-1/3 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C3E8FF]/60 text-[#4551D3] text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-[#1A9EF2]" />
                Introducing TheBlueprint v1.0
              </div>
              
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Plan Websites in <br />
                <span className="bg-gradient-to-r from-[#1A9EF2] to-[#4551D3] bg-clip-text text-transparent">
                  Minutes, Not Hours
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
                Turn standard, messy client discovery talks into clean, deliverable-ready sitemaps, custom page-type questionnaires, block wireframes, and professional proposals in minutes. 
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <a 
                  href="#simulator" 
                  className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold bg-[#1A9EF2] text-white hover:bg-[#4551D3] transition-all shadow-lg hover:shadow-xl shadow-[#1A9EF2]/20 flex items-center justify-center gap-2 group"
                >
                  Try the Live Demo
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a 
                  href="#pricing" 
                  className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  View Plans & Pricing
                </a>
              </div>

              {/* Small Social Proof / Metrics banner */}
              <div className="pt-8 border-t border-slate-100 grid grid-cols-3 gap-6 max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">10x</div>
                  <div className="text-xs sm:text-sm text-slate-500">Faster Proposal Building</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">100%</div>
                  <div className="text-xs sm:text-sm text-slate-500">Code-Free Outlines</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[#4551D3]">1 Project</div>
                  <div className="text-xs sm:text-sm text-slate-500">Free Tier Forever</div>
                </div>
              </div>
            </div>

            {/* Right Graphic/Preview Column */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-[420px] lg:max-w-none">
                {/* Simulated App Card */}
                <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 relative overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-xs text-slate-400 font-mono">project_outline_v1.pdf</div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-[#1A9EF2]" />
                        <span className="text-sm font-semibold text-slate-800">Sitemap Draft</span>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full font-semibold">Done</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[#4551D3]" />
                        <span className="text-sm font-semibold text-slate-800">Page Briefs & Questions</span>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full font-semibold">Done</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Layout className="w-5 h-5 text-[#6DC7FF]" />
                        <span className="text-sm font-semibold text-slate-800">Visual Wireframe Canvas</span>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full font-semibold">Done</span>
                    </div>

                    <div className="p-4 rounded-xl border border-dashed border-[#1A9EF2] bg-[#C3E8FF]/20 text-center space-y-2">
                      <div className="text-xs font-semibold text-[#4551D3]">Ready to Export Proposal</div>
                      <div className="flex gap-2 justify-center">
                        <span className="w-4 h-4 rounded bg-[#1A9EF2]" />
                        <span className="w-4 h-4 rounded bg-[#4551D3]" />
                        <span className="w-4 h-4 rounded bg-[#6DC7FF]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Badges */}
                <div className="absolute -top-6 -right-6 bg-white p-3.5 rounded-xl shadow-lg border border-slate-50 flex items-center gap-3 animate-bounce">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
                  <div>
                    <div className="text-xs text-slate-500">Proposal Compiled</div>
                    <div className="text-xs font-bold text-slate-800">100% Vector PDF</div>
                  </div>
                </div>

                <div className="absolute -bottom-6 -left-6 bg-white p-3.5 rounded-xl shadow-lg border border-slate-50 flex items-center gap-3">
                  <Palette className="w-5 h-5 text-[#1A9EF2]" />
                  <div>
                    <div className="text-xs text-slate-500">Custom Branding</div>
                    <div className="text-xs font-bold text-slate-800">Colors & Logo Saved</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Customer Segments */}
      <section id="segments" className="py-20 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              One Tool, Two Perfect Workflows
            </h2>
            <p className="text-lg text-slate-600">
              Whether you are an agency professional pitching high-ticket clients or an explorer launching your first business, we have got you covered.
            </p>
            
            {/* Segment Toggle Switch */}
            <div className="inline-flex p-1 bg-slate-200 rounded-xl mt-4">
              <button
                onClick={() => setActiveSegment("planners")}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeSegment === "planners" 
                    ? "bg-white text-slate-900 shadow-md" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                For Planners (Agencies/Freelancers)
              </button>
              <button
                onClick={() => setActiveSegment("explorers")}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeSegment === "explorers" 
                    ? "bg-white text-slate-900 shadow-md" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="w-4 h-4" />
                For Explorers (Entrepreneurs)
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {activeSegment === "planners" ? (
              <>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center font-bold text-xl">1</div>
                  <h3 className="text-xl font-bold text-slate-900">Accelerate Client Discovery</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Stop asking "What pages do you want?" Ask tailored, page-specific questions generated automatically based on page type to extract the brand story, product details, and copy hooks directly.
                  </p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center font-bold text-xl">2</div>
                  <h3 className="text-xl font-bold text-slate-900">Close Deals on Discovery Calls</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Plan custom hierarchical sitemaps, write page briefs, and drag/drop modules live on your Zoom calls. Export a completely customized, branded PDF proposal with project estimations before the client hangs up.
                  </p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center font-bold text-xl">3</div>
                  <h3 className="text-xl font-bold text-slate-900">Seamless Dev & Copy Handover</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Provide copywriters and builders with block-based visual wireframes, documented objectives, and client-approved discovery questionnaires. Eliminate misunderstandings, revisions, and project scope creep.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-[#C3E8FF] text-[#4551D3] flex items-center justify-center font-bold text-xl">1</div>
                  <h3 className="text-xl font-bold text-slate-900">De-mistify Your Requirements</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Don't know what pages you actually need? Answer our guided business wizard questions. We will automatically generate a tailored structure showing you exactly what pages your specific company needs.
                  </p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-[#C3E8FF] text-[#4551D3] flex items-center justify-center font-bold text-xl">2</div>
                  <h3 className="text-xl font-bold text-slate-900">Avoid Costly Agency Overpricing</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Agencies often overprice abstract web concepts. When you bring a compiled TheBlueprint PDF proposal including exact page schemas, briefs, and block mockups, you save up to 40% on design and development.
                  </p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-[#C3E8FF] text-[#4551D3] flex items-center justify-center font-bold text-xl">3</div>
                  <h3 className="text-xl font-bold text-slate-900">Clarify Your Vision Instantly</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Move your idea from "I want an online shop" to a structural reality: "I need a 5-page site with a product details schema, alternating copy section blocks, and integrated contact FAQs."
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 4. Core Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              The Five Core Planning Modules
            </h2>
            <p className="text-lg text-slate-600">
              Go from discovery questionnaire to structured wireframe mockups and client-ready proposals in minutes, all inside a single consolidated workspace.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            
            {/* Sitemap Card */}
            <div className="p-6 rounded-2xl border border-slate-100 hover:border-[#1A9EF2]/30 hover:bg-slate-50/50 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">1. Sitemap Builder</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Add, sort, and arrange pages hierarchically. Construct beautiful sitemap trees with deep nesting for logical user flows.
              </p>
            </div>

            {/* Outlines Card */}
            <div className="p-6 rounded-2xl border border-slate-100 hover:border-[#1A9EF2]/30 hover:bg-slate-50/50 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">2. Page Outlines</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Set descriptions, business goals, call-to-actions, and specific design directives per page to guide writers and developers.
              </p>
            </div>

            {/* Questionnaires Card */}
            <div className="p-6 rounded-2xl border border-slate-100 hover:border-[#1A9EF2]/30 hover:bg-slate-50/50 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">3. Content Surveys</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Automatically generate targeted copy questionnaires for each page type to easily compile all necessary copywriting content.
              </p>
            </div>

            {/* Wireframes Card */}
            <div className="p-6 rounded-2xl border border-slate-100 hover:border-[#1A9EF2]/30 hover:bg-slate-50/50 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center">
                <Layout className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">4. Wireframe Canvas</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Create simple, high-level layouts using modular sections (hero grids, testimonials, CTA bars) to capture page scopes visually.
              </p>
            </div>

            {/* Proposal Card */}
            <div className="p-6 rounded-2xl border border-slate-100 hover:border-[#1A9EF2]/30 hover:bg-slate-50/50 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-[#C3E8FF] text-[#1A9EF2] flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">5. Proposal Export</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Compile everything into a custom-branded professional PDF proposal (custom colors, logo, terms) and deliver to client inbox.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE LIVE SIMULATOR */}
      <section id="simulator" className="py-20 bg-slate-100 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
            <div className="text-xs font-bold text-[#1A9EF2] uppercase tracking-wider">Try TheBlueprint Live</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Interactive Planning Simulator
            </h2>
            <p className="text-base text-slate-600">
              Experience the absolute power of TheBlueprint right here. Click a template type, browse the live sitemap, view dynamically generated questionnaires, adjust your custom agency branding, and preview your proposal.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 grid lg:grid-cols-12 min-h-[600px]">
            
            {/* Left Control Panel / Category & Sitemap Picker (4 cols) */}
            <div className="lg:col-span-4 border-r border-slate-200 p-6 bg-slate-50/50 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    1. Select Project Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["ecommerce", "localbusiness", "saas"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSimulatorCategory(cat);
                          setSelectedSimPage(0);
                        }}
                        className={`py-2 px-3 text-xs font-bold rounded-lg capitalize border transition-all ${
                          simulatorCategory === cat 
                            ? "bg-[#1A9EF2] text-white border-[#1A9EF2]" 
                            : "bg-white text-slate-600 hover:text-slate-950 border-slate-200"
                        }`}
                      >
                        {cat === "localbusiness" ? "Local Biz" : cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    2. Interactive Sitemap Tree
                  </label>
                  <div className="space-y-2">
                    {activePages.map((page, index) => (
                      <button
                        key={page.id}
                        onClick={() => setSelectedSimPage(index)}
                        className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all ${
                          selectedSimPage === index 
                            ? "bg-[#C3E8FF] border-[#6DC7FF] text-slate-900" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Layers className="w-4 h-4 text-[#1A9EF2]" />
                          <span className="text-xs font-bold">{page.title}</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 capitalize">
                          {page.type || (page as any).page_type}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gated Feature Notification */}
              <div className="pt-6 border-t border-slate-100">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/50 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-amber-800">Free Tier Active</div>
                    <p className="text-[10px] text-amber-600 leading-normal mt-0.5">
                      You are simulating a single active project. Access premium branding controls and full multi-page PDF exports below by purchasing or subscribing.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Module / Questionnaire & Wireframe Preview (4 cols) */}
            <div className="lg:col-span-4 border-r border-slate-200 p-6 space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  3. Outlines & Copy Questionnaire
                </label>
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                    <span className="text-[10px] uppercase font-bold text-[#1A9EF2] block mb-1">Page Objective</span>
                    <p className="text-xs text-slate-700 leading-relaxed font-normal">
                      {currentPage.description}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#4551D3] block">Auto-Generated Client Questions</span>
                    {((QUESTIONNAIRE_TEMPLATES[(currentPage.type || (currentPage as any).page_type) as string]) || QUESTIONNAIRE_TEMPLATES.homepage).map((q: string, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-slate-100 bg-white shadow-xs">
                        <div className="text-[10px] text-slate-400 font-mono">Question {idx + 1}</div>
                        <div className="text-xs font-semibold text-slate-700 leading-snug mt-0.5">{q}</div>
                        <input 
                          type="text" 
                          placeholder="Client answers populate here..." 
                          disabled 
                          className="w-full mt-1.5 p-1 px-2 border border-slate-100 rounded text-[10px] bg-slate-50 text-slate-400 cursor-not-allowed"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Module / Premium Proposal & Export Simulator (4 cols) */}
            <div className="lg:col-span-4 p-6 bg-slate-50/20 flex flex-col justify-between space-y-6">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    4. Premium Branding Customizer
                  </label>
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1.5">Agency Logo Name</label>
                      <input 
                        type="text"
                        value={brandingLogo}
                        onChange={(e) => setBrandingLogo(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 mb-3"
                        placeholder="My Web Agency" 
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1.5">Agency Logo Asset</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { file: '/logo-blue.png', name: 'Blue', bg: 'bg-[#C3E8FF]/20' },
                          { file: '/logo-navy.png', name: 'Navy', bg: 'bg-slate-100' },
                          { file: '/logo-white.png', name: 'Black', bg: 'bg-slate-800' },
                          { file: '/logo-black.png', name: 'White', bg: 'bg-slate-50' }
                        ].map((logoItem) => (
                          <button
                            key={logoItem.file}
                            type="button"
                            onClick={() => setBrandLogoFile(logoItem.file)}
                            className={`p-1.5 rounded-lg border text-center transition-all ${
                              brandLogoFile === logoItem.file 
                                ? 'border-[#1A9EF2] ring-2 ring-[#C3E8FF]' 
                                : 'border-slate-200 hover:border-slate-300'
                            } ${logoItem.bg}`}
                          >
                            <img src={logoItem.file} alt={logoItem.name} className="h-4 w-auto mx-auto object-contain" />
                            <span className="text-[8px] text-slate-500 font-semibold block mt-1">{logoItem.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1.5">Primary Hex</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={brandPrimary} 
                            onChange={(e) => setBrandPrimary(e.target.value)}
                            className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">{brandPrimary}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1.5">Secondary Hex</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={brandSecondary} 
                            onChange={(e) => setBrandSecondary(e.target.value)}
                            className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-slate-700 uppercase font-bold">{brandSecondary}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    5. Proposal Live Preview
                  </label>
                  <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-3 text-center shadow-md relative overflow-hidden">
                    {/* Simulated Cover Branding Colors */}
                    <div 
                      className="h-2 w-full rounded-full transition-all"
                      style={{ backgroundColor: brandPrimary }}
                    />
                    
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">PROJECT PROPOSAL</div>
                      <div className="text-xs font-extrabold text-slate-800">
                        {simulatorCategory === 'ecommerce' && "E-Commerce Shop"}
                        {simulatorCategory === 'localbusiness' && "Local Plumber Service"}
                        {simulatorCategory === 'saas' && "Dashboard SaaS Platform"}
                      </div>
                      <div className="text-[9px] text-slate-500 flex items-center justify-center gap-1">
                        Prepared by: <span className="font-bold text-slate-700" style={{ color: brandSecondary }}>{brandingLogo}</span>
                      </div>
                    </div>

                    <div className="flex justify-center gap-1.5 pt-1">
                      <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border">
                        {activePages.length} Pages
                      </span>
                      <span className="text-[8px] bg-[#C3E8FF] text-[#1A9EF2] px-1.5 py-0.5 rounded font-mono">
                        Vector Sitemap
                      </span>
                    </div>

                    {isExported && (
                      <div className="absolute inset-0 bg-[#1A9EF2]/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-white animate-fade-in">
                        <CheckCircle2 className="w-8 h-8 text-white mb-2" />
                        <span className="text-xs font-bold">Vector PDF Exported!</span>
                        <span className="text-[9px] text-[#C3E8FF] leading-relaxed mt-1">
                          Downloaded successfully to client's download path.
                        </span>
                        <button 
                          onClick={() => setIsExported(false)}
                          className="mt-3 px-3 py-1 bg-white text-[#1A9EF2] rounded text-[10px] font-bold shadow-sm hover:bg-[#C3E8FF] transition-all"
                        >
                          Reset Simulation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  setIsExported(true);
                }}
                className="w-full py-3.5 rounded-xl font-bold bg-[#1A9EF2] hover:bg-[#4551D3] text-white shadow-md shadow-[#1A9EF2]/20 flex items-center justify-center gap-2 text-sm transition-all"
              >
                <Download className="w-4 h-4" />
                Simulate Branded PDF Export
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Free vs. Premium Gating Summary Table */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
            <h2 className="text-3xl font-extrabold text-slate-900">
              Clear & Honest Pricing Gating
            </h2>
            <p className="text-slate-600 text-sm">
              We never charge hidden fees or utilize aggressive pressure tactics. Here is how our Free tier compare with our Premium plans.
            </p>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-bold text-slate-800">Feature</th>
                  <th className="p-4 font-bold text-slate-800 text-center">Free Plan</th>
                  <th className="p-4 font-bold text-[#1A9EF2] text-center">Premium Plans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-4 font-semibold text-slate-800">Active Projects Count</td>
                  <td className="p-4 text-center text-slate-500 font-medium">1 Active Project</td>
                  <td className="p-4 text-center text-slate-950 font-bold flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Unlimited Projects
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800">Sitemap Hierarchy Builder</td>
                  <td className="p-4 text-center text-slate-500">Up to 10 Pages</td>
                  <td className="p-4 text-center text-slate-900 font-medium">Unlimited Pages</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800">Outline objectives & briefs</td>
                  <td className="p-4 text-center text-slate-800 font-medium text-emerald-500">✔ Included</td>
                  <td className="p-4 text-center text-slate-800 font-medium text-emerald-500">✔ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800">Content Questionnaire Surveys</td>
                  <td className="p-4 text-center text-slate-800 font-medium text-emerald-500">✔ Included</td>
                  <td className="p-4 text-center text-slate-800 font-medium text-emerald-500">✔ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800">Custom Agency Branding (Colors & Logo)</td>
                  <td className="p-4 text-center text-slate-300 font-bold">✘ Locked</td>
                  <td className="p-4 text-center text-slate-800 font-semibold text-emerald-500">✔ Included</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-slate-800">Vector Proposal PDF Download</td>
                  <td className="p-4 text-center text-slate-300 font-bold">✘ Locked</td>
                  <td className="p-4 text-center text-slate-800 font-semibold text-emerald-500">✔ Included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. Pricing Tiers */}
      <section id="pricing" className="py-20 bg-slate-100 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Pricing Options Built for Every Stage
            </h2>
            <p className="text-lg text-slate-600">
              Choose the license that matches your volume. No credit card required to start on our Free Tier.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
            
            {/* Free Tier */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">Free Tier</h3>
                  <p className="text-slate-500 text-sm mt-1">Perfect for entrepreneurs planning their first site</p>
                </div>
                
                <div className="flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">$0</span>
                  <span className="ml-1 text-sm font-semibold text-slate-500">/ forever</span>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <ul className="space-y-3.5">
                    {[
                      "1 Active Web Project",
                      "Visual Sitemap Tree Builder (Up to 10 pages)",
                      "Page Objectives & Copy Outlines",
                      "Standard Client Discovery Surveys",
                      "Interactive Wireframe Canvas Preview"
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-3 text-sm text-slate-600">
                        <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <a href="/register" className="block w-full py-3.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all text-sm text-center">
                  Get Started Free
                </a>
              </div>
            </div>

            {/* One-Time Plan */}
            <div className="bg-white rounded-3xl p-8 border-2 border-[#1A9EF2] shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#1A9EF2] text-white text-[10px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-bl-xl">
                Best Value for Builders
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-slate-900">TheBlueprint Pro — One-Time License</h3>
                    <span className="px-2 py-0.5 rounded bg-[#C3E8FF] text-[#1A9EF2] text-xs font-bold">POPULAR</span>
                  </div>
                  <p className="text-slate-500 text-sm mt-1">For freelancers, individual builders, and designers</p>
                </div>
                
                <div className="flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">$149</span>
                  <span className="ml-1 text-sm font-semibold text-slate-500">/ one-time pay</span>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <ul className="space-y-3.5">
                    {[
                      "Unlimited Web Projects",
                      "Unlimited Sitemap nesting & sorting",
                      "Custom branding colors and agency logo settings",
                      "Full, high-resolution vector PDF proposal exports",
                      "Advanced Wireframe blocks and customization",
                      "1 year of free updates & priority downloads"
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-3 text-sm text-slate-600">
                        <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="font-medium text-slate-800">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <a href="https://buy.stripe.com/8x214n4nP06zaoud2M7Re02" target="_blank" rel="noopener noreferrer" className="block w-full py-3.5 rounded-xl font-bold bg-[#1A9EF2] hover:bg-[#4551D3] text-white transition-all text-sm shadow-md shadow-[#1A9EF2]/10 text-center">
                  Purchase License
                </a>
              </div>
            </div>

            {/* Subscription Plan */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">TheBlueprint Pro — Monthly Subscription</h3>
                  <p className="text-slate-500 text-sm mt-1">For growing marketing teams, agencies, and builders</p>
                </div>
                
                <div className="flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">$29</span>
                  <span className="ml-1 text-sm font-semibold text-slate-500">/ month</span>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <ul className="space-y-3.5">
                    {[
                      "Unlimited Web Projects with full scale sitemaps",
                      "Everything included in the One-Time purchase plan",
                      "Collaborative teammate workspaces (Coming Soon)",
                      "Multi-client portal PDF export themes",
                      "Priority 24-hour Email & Chat Support desk"
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-3 text-sm text-slate-600">
                        <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <a href="https://buy.stripe.com/14A14n1o8cfygra1rof4i7L" target="_blank" rel="noopener noreferrer" className="block w-full py-3.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all text-sm text-center">
                  Subscribe Now
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 8. FAQ Section */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
            <p className="text-slate-600">Have some questions? We have compiled the answers to the most common queries.</p>
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">How does the 1 active project limit on the Free tier work?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                The Free plan lets you create and fully outline, survey, and mock up one (1) single website blueprint at a time. If you need to plan a new client project, you can archive or delete the existing project, or upgrade to our Premium plan to create unlimited concurrent maps.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">What makes TheBlueprint PDF exports unique?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                TheBlueprint exports beautiful, agency-branded, vector-based PDF files. Rather than just screenshotting cards, the export compiles the entire sitemap tree, individual page briefs, and visual layouts into an elegant, unified project proposal document with your agency's logo and primary colors.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Do my clients need accounts to answer content questionnaires?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                No, they do not. With premium plans, you can share a clean, client-facing survey link where they can type their copy briefs directly. The answers automatically map back and update in your page sitemap and wireframe grids.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="flex justify-center items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-[#1A9EF2] flex items-center justify-center text-white font-bold">
              <Compass className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold">TheBlueprint</span>
          </div>
          
          <p className="text-sm max-w-md mx-auto">
            The all-in-one website planner that converts rough concepts into complete sitemaps, briefs, sitemaps, wireframes, and contracts in minutes.
          </p>

          <div className="text-xs text-slate-500 border-t border-slate-800 pt-6">
            © {new Date().getFullYear()} First Creation Media. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage />} />
      <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/app/projects/:projectId" element={<ProtectedRoute><SitemapBuilderPage /></ProtectedRoute>} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

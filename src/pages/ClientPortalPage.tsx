import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';
import { Compass, ChevronDown, ChevronRight } from 'lucide-react';

interface ProjectData {
  project: { id: string; title: string; description: string; branding_primary_color: string; branding_secondary_color: string };
  member: { role: string; email: string };
  isClient: boolean;
  pages: any[];
}

export default function ClientPortalPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useTitle('Nuria Website Blueprint | Nuria AI');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [bpBranding, setBpBranding] = useState<any>(null);

  useEffect(() => {
    if (!projectId || !token) { setError('Missing project or token'); setLoading(false); return; }
    fetch(`/api/projects/${projectId}/client-view?token=${token}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    // Also try to fetch blueprint branding
    fetch('/api/account/blueprint-whitelabel', { credentials: 'include' }).then(r => r.json()).then(d => d.enabled ? setBpBranding(d) : null).catch(() => {});
  }, [projectId, token]);

  const handleAnswerChange = (pageId: string, question: string, value: string) => {
    setAnswers(prev => ({ ...prev, [`${pageId}:${question}`]: value }));
  };

  const handleSaveAnswers = async (pageId: string) => {
    setSaving(true);
    const pageAnswers: Record<string, string> = {};
    Object.entries(answers).forEach(([key, val]) => {
      if (key.startsWith(`${pageId}:`)) pageAnswers[key.replace(`${pageId}:`, '')] = val;
    });
    try {
      await fetch(`/api/pages/${pageId}/questionnaire`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: pageAnswers }), credentials: 'include',
      });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#1A9EF2] border-t-transparent rounded-full" /></div>;
  if (error) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-center"><p className="text-red-500 font-semibold">{error}</p><p className="text-slate-400 text-sm mt-2">Please check your access link</p></div></div>;
  if (!data) return null;

  const { project, member, isClient, pages } = data;
  const brandColor = bpBranding?.primaryColor || '#1A9EF2';
  const brandName = bpBranding?.companyName || 'Nuria Website Blueprint';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimal header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColor }}>
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">{project.title}</span>
          </div>
          <div className="text-xs text-slate-400">{member.email} · {member.role}</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Project overview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">{project.title}</h1>
          {project.description && <p className="text-slate-500 mt-2">{project.description}</p>}
        </div>

        {/* Sitemap — read-only tree */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Sitemap</h2>
          <div className="space-y-1">
            {pages.map((page: any) => (
              <div key={page.id}>
                <button onClick={() => setExpandedPage(expandedPage === page.id ? null : page.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left">
                  {expandedPage === page.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-semibold text-slate-800">{page.title}</span>
                  <span className="text-xs text-slate-400 ml-auto">{page.page_type}</span>
                </button>
                {expandedPage === page.id && (
                  <div className="ml-8 p-3 border-l-2 border-[#C3E8FF] bg-slate-50 rounded-r-lg mb-2" style={{ borderLeftColor: brandColor + '40' }}>
                    {page.description && <p className="text-sm text-slate-500 mb-2">{page.description}</p>}
                    {page.goals && <p className="text-xs text-slate-400 mb-2"><strong>Goals:</strong> {page.goals}</p>}

                    {/* Questionnaire — editable for clients */}
                    {page.questionnaire && page.questionnaire.questions?.length > 0 && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-slate-100">
                        <h4 className="text-xs font-bold uppercase mb-2" style={{ color: brandColor }}>Content Questions</h4>
                        {page.questionnaire.questions.map((q: string, i: number) => {
                          const key = `${page.id}:${q}`;
                          const existingAnswer = page.questionnaire?.answers?.[q] || '';
                          return (
                            <div key={i} className="mb-3">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">{q}</label>
                              <textarea
                                value={answers[key] ?? existingAnswer}
                                onChange={e => handleAnswerChange(page.id, q, e.target.value)}
                                placeholder="Type your answer..."
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none h-20 focus:border-[#1A9EF2] focus:ring-1 focus:ring-[#C3E8FF] outline-none"
                                readOnly={!isClient}
                              />
                            </div>
                          );
                        })}
                        {isClient && (
                          <button onClick={() => handleSaveAnswers(page.id)}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-white text-xs font-semibold transition-all disabled:opacity-50 hover:opacity-90"
                            style={{ backgroundColor: brandColor }}>
                            {saving ? 'Saving...' : 'Save Answers'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Read-only note */}
        {isClient && (
          <div className="text-center text-xs text-slate-400 py-4">
            Client portal · {brandName}
          </div>
        )}
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleSlash,
  ClipboardList,
  Gauge,
  Info,
  XCircle,
} from 'lucide-react';
import { api, type QaAnswerStatus, type QaChecklistResponse, type QaSeverity, type QaSummary } from '../lib/api';
import { Alert, Card, Spinner } from '../components/ui';

const SEVERITY_STYLES: Record<QaSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-brand-light text-brand-secondary',
  low: 'bg-slate-100 text-slate-600',
};

const SEVERITY_LABELS: Record<QaSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const READINESS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  not_ready: 'bg-red-100 text-red-700',
  needs_attention: 'bg-amber-100 text-amber-700',
  nearly_ready: 'bg-brand-light text-brand-secondary',
  ready: 'bg-emerald-100 text-emerald-700',
};

const READINESS_BAR: Record<string, string> = {
  not_started: 'bg-slate-300',
  not_ready: 'bg-red-500',
  needs_attention: 'bg-amber-500',
  nearly_ready: 'bg-brand',
  ready: 'bg-emerald-500',
};

const ANSWER_OPTIONS: Array<{ value: QaAnswerStatus; label: string; icon: typeof CheckCircle2; active: string }> = [
  { value: 'pass', label: 'Pass', icon: CheckCircle2, active: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'fail', label: 'Fail', icon: XCircle, active: 'bg-red-600 text-white border-red-600' },
  { value: 'needs_review', label: 'Needs review', icon: AlertTriangle, active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'not_applicable', label: 'N/A', icon: CircleSlash, active: 'bg-slate-600 text-white border-slate-600' },
];

export default function QaChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<QaChecklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    api.qa
      .get(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the checklist'))
      .finally(() => setLoading(false));
  }, [id]);

  const summary: QaSummary | null = data?.summary ?? null;

  const totalItems = useMemo(
    () => data?.categories.reduce((sum, category) => sum + category.items.length, 0) ?? 0,
    [data],
  );

  const applyAnswer = useCallback(
    async (itemId: string, status: QaAnswerStatus, notes?: string | null) => {
      if (!id || !data) return;
      setError(null);
      setSavingItem(itemId);

      const previous = data;
      // Optimistic status change; the authoritative summary comes back from the server.
      setData({
        ...data,
        categories: data.categories.map((category) => ({
          ...category,
          items: category.items.map((item) => (item.id === itemId ? { ...item, status } : item)),
        })),
      });

      try {
        const result = await api.qa.answer(id, itemId, notes === undefined ? { status } : { status, notes });
        setData((current) =>
          current
            ? {
                run: result.run,
                summary: result.summary,
                categories: current.categories.map((category) => ({
                  ...category,
                  items: category.items.map((item) =>
                    item.id === itemId ? { ...item, ...result.item } : item,
                  ),
                })),
              }
            : current,
        );
        setNoteDrafts((drafts) => {
          const next = { ...drafts };
          delete next[itemId];
          return next;
        });
      } catch (err) {
        setData(previous);
        setError(err instanceof Error ? err.message : 'Unable to save that answer.');
      } finally {
        setSavingItem(null);
      }
    },
    [data, id],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 text-brand" />
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div className="space-y-4">
        <Alert>{error || 'Checklist unavailable'}</Alert>
        <Link to="/projects" className="text-sm font-medium text-brand hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to={`/projects/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to project
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">QA checklist</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalItems} checks across {data.categories.length} categories · every answer is saved as you work
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <ScorePanel summary={summary} />

      {/* Category jump nav */}
      <nav aria-label="Checklist categories" className="mt-6 flex flex-wrap gap-2">
        {summary.categories.map((category) => (
          <a
            key={category.id}
            href={`#category-${category.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand-secondary"
          >
            {category.name}
            <span className="text-slate-400">
              {category.counts.total - category.counts.notChecked}/{category.counts.total}
            </span>
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-8">
        {data.categories.map((category) => {
          const categoryScore = summary.categories.find((entry) => entry.id === category.id);
          const answered = category.items.filter((item) => item.status !== 'not_checked').length;

          return (
            <section key={category.id} id={`category-${category.id}`} className="scroll-mt-20">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{category.name}</h2>
                  {category.description && <p className="mt-0.5 text-sm text-slate-500">{category.description}</p>}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div className="font-semibold text-slate-700">
                    {answered}/{category.items.length} answered
                  </div>
                  <div>{categoryScore?.score === null ? 'No score yet' : `${categoryScore?.score}% passed`}</div>
                </div>
              </div>

              <ul className="mt-3 space-y-3">
                {category.items.map((item) => {
                  const notesValue = noteDrafts[item.id] ?? item.notes ?? '';
                  return (
                    <li key={item.id}>
                      <Card className={`p-4 sm:p-5 ${item.status === 'fail' ? 'border-red-200' : ''}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <SeverityBadge severity={item.severity} />
                            <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                          </div>
                          {savingItem === item.id && <Spinner className="h-4 w-4 text-brand" />}
                        </div>

                        {item.description && <p className="mt-2 text-sm text-slate-600">{item.description}</p>}
                        {item.remediation && (
                          <p className="mt-1.5 text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">How to check:</span> {item.remediation}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Answer for ${item.title}`}>
                          {ANSWER_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const selected = item.status === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() =>
                                  applyAnswer(item.id, selected ? 'not_checked' : option.value)
                                }
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  selected
                                    ? option.active
                                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {option.label}
                              </button>
                            );
                          })}
                          {item.status === 'not_checked' && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Circle className="h-3 w-3" />
                              Not checked
                            </span>
                          )}
                        </div>

                        <details className="mt-3" open={Boolean(item.notes)}>
                          <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">
                            Notes{item.notes ? ' · saved' : ''}
                          </summary>
                          <textarea
                            rows={2}
                            maxLength={2000}
                            value={notesValue}
                            placeholder="What did you find? What still needs fixing?"
                            onChange={(event) =>
                              setNoteDrafts((drafts) => ({ ...drafts, [item.id]: event.target.value }))
                            }
                            onBlur={() => {
                              const draft = noteDrafts[item.id];
                              if (draft === undefined) return;
                              if ((item.notes ?? '') === draft.trim()) {
                                setNoteDrafts((drafts) => {
                                  const next = { ...drafts };
                                  delete next[item.id];
                                  return next;
                                });
                                return;
                              }
                              void applyAnswer(item.id, item.status, draft.trim() || null);
                            }}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                          />
                        </details>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-10 flex items-start gap-2 text-xs text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Nothing here was measured automatically. This is a record of what you reviewed, scored by a fixed
        rule set — not a technical test of the live site.
      </p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: QaSeverity }) {
  return (
    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function ScorePanel({ summary }: { summary: QaSummary }) {
  const { counts, readiness } = summary;
  const readinessClass = READINESS_STYLES[readiness.status] ?? READINESS_STYLES.not_started;

  return (
    <Card className="mt-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-slate-50 ring-4 ring-slate-100">
            <Gauge className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="text-2xl font-bold text-slate-900">
              {summary.score === null ? '—' : summary.score}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">QA Readiness Score</p>
            <p className="text-sm text-slate-500">
              {summary.score === null ? 'Not scored yet — answer a check to begin.' : 'out of 100, weighted by severity'}
            </p>
            <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${readinessClass}`}>
              <ClipboardList className="h-3.5 w-3.5" />
              {readiness.label}
            </span>
          </div>
        </div>

        <div className="min-w-[220px] flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Completion</span>
            <span>{summary.completionPercentage}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${READINESS_BAR[readiness.status] ?? READINESS_BAR.not_started}`}
              style={{ width: `${summary.completionPercentage}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{readiness.reason}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Count label="Passed" value={counts.passed} tone="text-emerald-600" />
        <Count label="Failed" value={counts.failed} tone="text-red-600" />
        <Count label="Needs review" value={counts.needsReview} tone="text-amber-600" />
        <Count label="N/A" value={counts.notApplicable} tone="text-slate-600" />
        <Count label="Not checked" value={counts.notChecked} tone="text-slate-500" />
        <Count label="Critical failures" value={counts.criticalFailures} tone={counts.criticalFailures ? 'text-red-600' : 'text-slate-500'} />
      </dl>

      <details className="mt-5 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">
          How the score is calculated
        </summary>
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <p>Each check carries a weight from its severity: critical 5, high 3, medium 2, low 1.</p>
          <p>
            Passed checks earn their full weight, “needs review” earns half, failed checks earn nothing.
            N/A and unchecked items are left out of the calculation.
          </p>
          <p>
            The score is the earned weight divided by the weight of everything reviewed. Launch readiness is
            decided separately by fixed gates: no failed critical or high check, every critical and high check
            reviewed, and a score of at least 90 for “Ready for launch”.
          </p>
        </div>
      </details>
    </Card>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-lg font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

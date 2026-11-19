import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleSlash,
  ClipboardList,
  Download,
  FileCode2,
  FileText,
  GitCompareArrows,
  Gauge,
  History,
  Info,
  Plus,
  XCircle,
} from 'lucide-react';
import {
  api,
  type QaAnswerStatus,
  type QaChecklistResponse,
  type QaRunSummary,
  type QaSeverity,
  type QaSummary,
} from '../lib/api';
import { Alert, Button, Card, Spinner } from '../components/ui';

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

const READINESS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  not_ready: 'Not ready',
  needs_attention: 'Needs attention',
  nearly_ready: 'Nearly ready',
  ready: 'Ready for launch',
};

const ANSWER_OPTIONS: Array<{ value: QaAnswerStatus; label: string; icon: typeof CheckCircle2; active: string }> = [
  { value: 'pass', label: 'Pass', icon: CheckCircle2, active: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'fail', label: 'Fail', icon: XCircle, active: 'bg-red-600 text-white border-red-600' },
  { value: 'needs_review', label: 'Needs review', icon: AlertTriangle, active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'not_applicable', label: 'N/A', icon: CircleSlash, active: 'bg-slate-600 text-white border-slate-600' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QaChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const viewingRunId = searchParams.get('run');

  const [data, setData] = useState<QaChecklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [showNewRun, setShowNewRun] = useState(false);
  const [carryForward, setCarryForward] = useState(true);
  const [starting, setStarting] = useState(false);
  const [compareBase, setCompareBase] = useState('');
  const [compareHead, setCompareHead] = useState('');
  const [exportCompareTo, setExportCompareTo] = useState('');

  const load = useCallback(
    async (runId: string | null) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const result = runId ? await api.qa.getRun(id, runId) : await api.qa.get(id);
        setData(result);
        const runs = result.runs;
        setCompareHead(runs[0]?.id ?? '');
        setCompareBase(runs[1]?.id ?? runs[0]?.id ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load the checklist');
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(viewingRunId);
  }, [load, viewingRunId]);

  // A comparison chosen for one run does not carry over to another run's export.
  const viewedRunId = data?.run.id;
  useEffect(() => {
    setExportCompareTo('');
  }, [viewedRunId]);

  const summary: QaSummary | null = data?.summary ?? null;
  const readOnly = Boolean(data) && !data?.is_current;

  const totalItems = useMemo(
    () => data?.categories.reduce((sum, category) => sum + category.items.length, 0) ?? 0,
    [data],
  );

  const applyAnswer = useCallback(
    async (itemId: string, status: QaAnswerStatus, notes?: string | null) => {
      if (!id || !data || readOnly) return;
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
                ...current,
                run: result.run,
                summary: result.summary,
                runs: result.runs,
                currentRunId: result.currentRunId,
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
    [data, id, readOnly],
  );

  const startNewRun = useCallback(async () => {
    if (!id) return;
    setStarting(true);
    setError(null);
    try {
      const result = await api.qa.startRun(id, { carryForward });
      setShowNewRun(false);
      setData(result);
      if (viewingRunId) {
        setSearchParams({}, { replace: true });
      } else {
        setCompareHead(result.runs[0]?.id ?? '');
        setCompareBase(result.runs[1]?.id ?? result.runs[0]?.id ?? '');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start a new run.');
    } finally {
      setStarting(false);
    }
  }, [carryForward, id, setSearchParams, viewingRunId]);

  const goCompare = useCallback(() => {
    if (!id || !compareBase || !compareHead) return;
    navigate(`/projects/${id}/qa/compare?base=${compareBase}&head=${compareHead}`);
  }, [compareBase, compareHead, id, navigate]);

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

  const runLabel = data.run.label || 'QA run';

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
            {runLabel} · started {formatDate(data.run.started_at)} · {totalItems} checks across{' '}
            {data.categories.length} categories
          </p>
        </div>
        {!readOnly && (
          <Button variant="secondary" onClick={() => setShowNewRun((open) => !open)}>
            <Plus className="h-4 w-4" />
            Start a new run
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {readOnly && (
        <div className="mt-4">
          <Alert variant="info">
            You are viewing an earlier run — it is read only, so its results stay comparable.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Go to the current run
            </button>
            .
          </Alert>
        </div>
      )}

      {showNewRun && !readOnly && (
        <Card className="mt-4 border-brand-light p-5">
          <h2 className="text-base font-semibold text-slate-900">Start a new run</h2>
          <p className="mt-1 text-sm text-slate-600">
            A new run keeps this one exactly as it is, so you can compare the two afterwards.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={carryForward}
              onChange={(event) => setCarryForward(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span>
              Start from this run’s answers
              <span className="block text-xs text-slate-500">
                Every answer and note is copied in as a starting point. Turn this off for a blank checklist.
              </span>
            </span>
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void startNewRun()} loading={starting}>
              Start run
            </Button>
            <Button variant="ghost" onClick={() => setShowNewRun(false)} disabled={starting}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <ScorePanel summary={summary} />

      <ReportExport
        projectId={id ?? ''}
        runId={data.run.id}
        runs={data.runs}
        compareTo={exportCompareTo}
        onCompareToChange={setExportCompareTo}
      />

      <RunHistory
        runs={data.runs}
        currentRunId={data.currentRunId}
        viewingRunId={data.run.id}
        compareBase={compareBase}
        compareHead={compareHead}
        onBaseChange={setCompareBase}
        onHeadChange={setCompareHead}
        onCompare={goCompare}
        onView={(runId) =>
          setSearchParams(runId === data.currentRunId ? {} : { run: runId }, { replace: true })
        }
      />

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
                                disabled={readOnly}
                                onClick={() =>
                                  applyAnswer(item.id, selected ? 'not_checked' : option.value)
                                }
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
                            disabled={readOnly}
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
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50"
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

function RunHistory({
  runs,
  currentRunId,
  viewingRunId,
  compareBase,
  compareHead,
  onBaseChange,
  onHeadChange,
  onCompare,
  onView,
}: {
  runs: QaRunSummary[];
  currentRunId: string;
  viewingRunId: string;
  compareBase: string;
  compareHead: string;
  onBaseChange: (value: string) => void;
  onHeadChange: (value: string) => void;
  onCompare: () => void;
  onView: (runId: string) => void;
}) {
  const canCompare = runs.length >= 2 && Boolean(compareBase) && Boolean(compareHead);

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <History className="h-4 w-4 text-slate-400" />
          Run history
        </h2>
        <p className="text-xs text-slate-500">
          {runs.length} {runs.length === 1 ? 'run' : 'runs'} · newest first
        </p>
      </div>

      <ol className="mt-3 divide-y divide-slate-100">
        {runs.map((run) => {
          const isViewing = run.id === viewingRunId;
          const readiness = run.launch_status ?? 'not_started';
          return (
            <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{run.label || 'QA run'}</span>
                  {run.id === currentRunId && (
                    <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-secondary">
                      Current
                    </span>
                  )}
                  {isViewing && run.id !== currentRunId && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Viewing
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(run.started_at)} · {run.answered} answered
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${READINESS_STYLES[readiness]}`}>
                  {READINESS_LABELS[readiness]}
                </span>
                <span className="w-12 text-right text-sm font-bold text-slate-900">
                  {run.score === null ? '—' : run.score}
                </span>
                {!isViewing && (
                  <button
                    type="button"
                    onClick={() => onView(run.id)}
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand hover:underline"
                  >
                    View
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <GitCompareArrows className="h-4 w-4 text-slate-400" />
          Compare two runs
        </p>
        {runs.length < 2 ? (
          <p className="mt-1 text-xs text-slate-500">
            Start a second run to compare what changed — fixed checks, new breakage, and the score movement.
          </p>
        ) : (
          <>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-500">
                Earlier run (before)
                <select
                  value={compareBase}
                  onChange={(event) => onBaseChange(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.label || 'QA run'} · {formatDate(run.started_at)} · {run.score === null ? '—' : run.score}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Later run (after)
                <select
                  value={compareHead}
                  onChange={(event) => onHeadChange(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.label || 'QA run'} · {formatDate(run.started_at)} · {run.score === null ? '—' : run.score}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button className="mt-3" onClick={onCompare} disabled={!canCompare}>
              <GitCompareArrows className="h-4 w-4" />
              Compare runs
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function ReportExport({
  projectId,
  runId,
  runs,
  compareTo,
  onCompareToChange,
}: {
  projectId: string;
  runId: string;
  runs: QaRunSummary[];
  compareTo: string;
  onCompareToChange: (value: string) => void;
}) {
  const others = runs.filter((run) => run.id !== runId);
  const linkBase =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors';

  return (
    <Card className="mt-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <FileText className="h-4 w-4 text-slate-400" />
        Export report
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        A client-ready report of this run: the readiness score and gate, the category breakdown, and every
        failing or needs-review check with your notes. Download it as a PDF, or as a single HTML file you can
        open or forward anywhere.
      </p>

      {others.length > 0 && (
        <label className="mt-3 block max-w-sm text-xs font-semibold text-slate-500">
          Compare against an earlier run
          <select
            value={compareTo}
            onChange={(event) => onCompareToChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">No comparison</option>
            {others.map((run) => (
              <option key={run.id} value={run.id}>
                {run.label || 'QA run'} · {formatDate(run.started_at)} · {run.score === null ? '—' : run.score}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] font-normal text-slate-500">
            Adds what was fixed and what broke since that run.
          </span>
        </label>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={api.qa.reportUrl(projectId, runId, 'pdf', compareTo)}
          className={`${linkBase} bg-brand text-white hover:bg-brand/90`}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
        <a
          href={api.qa.reportUrl(projectId, runId, 'html', compareTo)}
          className={`${linkBase} bg-brand-light text-brand-secondary hover:bg-brand-light/70`}
        >
          <FileCode2 className="h-4 w-4" />
          Download HTML
        </a>
      </div>
    </Card>
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

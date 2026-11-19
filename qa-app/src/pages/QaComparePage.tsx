import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCode2,
  Info,
  Minus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  api,
  type QaAnswerStatus,
  type QaComparison,
  type QaItemChange,
  type QaRunSummary,
  type QaSeverity,
} from '../lib/api';
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

const READINESS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  not_ready: 'Not ready',
  needs_attention: 'Needs attention',
  nearly_ready: 'Nearly ready',
  ready: 'Ready for launch',
};

const READINESS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  not_ready: 'bg-red-100 text-red-700',
  needs_attention: 'bg-amber-100 text-amber-700',
  nearly_ready: 'bg-brand-light text-brand-secondary',
  ready: 'bg-emerald-100 text-emerald-700',
};

const STATUS_LABELS: Record<QaAnswerStatus, string> = {
  not_checked: 'Not checked',
  pass: 'Pass',
  fail: 'Fail',
  needs_review: 'Needs review',
  not_applicable: 'N/A',
};

const STATUS_STYLES: Record<QaAnswerStatus, string> = {
  not_checked: 'bg-slate-100 text-slate-600',
  pass: 'bg-emerald-100 text-emerald-700',
  fail: 'bg-red-100 text-red-700',
  needs_review: 'bg-amber-100 text-amber-700',
  not_applicable: 'bg-slate-200 text-slate-600',
};

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

function runName(run: QaRunSummary | undefined): string {
  return run?.label || 'QA run';
}

export default function QaComparePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseId = searchParams.get('base') ?? '';
  const headId = searchParams.get('head') ?? '';

  const [runs, setRuns] = useState<QaRunSummary[]>([]);
  const [comparison, setComparison] = useState<QaComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the run list once; pick a sensible default pair if the URL has none.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.qa
      .runs(id)
      .then((result) => {
        if (cancelled) return;
        setRuns(result.runs);
        if (!baseId || !headId) {
          const head = result.runs[0]?.id ?? '';
          const base = result.runs[1]?.id ?? head;
          if (head) setSearchParams({ base, head }, { replace: true });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load the run history');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadComparison = useCallback(async () => {
    if (!id || !baseId || !headId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.qa.compare(id, baseId, headId);
      setComparison(result.comparison);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compare those runs');
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, [baseId, headId, id]);

  useEffect(() => {
    void loadComparison();
  }, [loadComparison]);

  const baseRun = useMemo(() => runs.find((run) => run.id === baseId), [runs, baseId]);
  const headRun = useMemo(() => runs.find((run) => run.id === headId), [runs, headId]);

  const updatePair = (nextBase: string, nextHead: string) => {
    setSearchParams({ base: nextBase, head: nextHead });
  };

  const swap = () => updatePair(headId, baseId);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to={id ? `/projects/${id}/qa` : '/projects'}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the checklist
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Run comparison</h1>
          <p className="mt-1 text-sm text-slate-500">
            {runName(baseRun)} → {runName(headRun)} · what got fixed, what broke, and how the score moved
          </p>
        </div>
        {id && headId && baseId && baseId !== headId && (
          <div className="flex flex-wrap gap-2">
            <a
              href={api.qa.reportUrl(id, headId, 'pdf', baseId)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </a>
            <a
              href={api.qa.reportUrl(id, headId, 'html', baseId)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand-secondary transition-colors hover:bg-brand-light/70"
            >
              <FileCode2 className="h-4 w-4" />
              Export HTML
            </a>
          </div>
        )}
      </div>

      {runs.length >= 2 && (
        <Card className="mt-5 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[200px] flex-1 text-xs font-semibold text-slate-500">
              Earlier run (before)
              <select
                value={baseId}
                onChange={(event) => updatePair(event.target.value, headId)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runName(run)} · {formatDate(run.started_at)} · {run.score === null ? '—' : run.score}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={swap}
              title="Swap the two runs"
              aria-label="Swap the two runs"
              className="mb-1 rounded-lg border border-slate-300 bg-white p-2 text-slate-500 hover:border-brand hover:text-brand"
            >
              <ArrowRight className="h-4 w-4" />
            </button>

            <label className="min-w-[200px] flex-1 text-xs font-semibold text-slate-500">
              Later run (after)
              <select
                value={headId}
                onChange={(event) => updatePair(baseId, event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runName(run)} · {formatDate(run.started_at)} · {run.score === null ? '—' : run.score}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      )}

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {baseId && headId && baseId === headId && (
        <div className="mt-4">
          <Alert variant="info">
            These are the same run, so nothing has changed. Pick a different earlier or later run above.
          </Alert>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 text-brand" />
        </div>
      )}

      {!loading && !comparison && !error && (
        <div className="mt-6">
          <Alert variant="info">
            {runs.length < 2
              ? 'There is only one run for this project. Start a second run from the checklist to compare them.'
              : 'Choose two runs above to compare them.'}
          </Alert>
        </div>
      )}

      {!loading && comparison && (
        <>
          <SummaryPanel comparison={comparison} />

          <div className="mt-5 space-y-4">
            <ChangeList
              title="Newly fixed"
              description="Failing or needing review in the earlier run, passing in the later one."
              tone="emerald"
              icon={CheckCircle2}
              items={comparison.fixed}
              emptyText="No checks moved to pass between these runs."
            />
            <ChangeList
              title="Newly broken"
              description="Passing or needing review before, failing now."
              tone="red"
              icon={XCircle}
              items={comparison.broken}
              emptyText="Nothing that was passing is failing now."
            />
            <ChangeList
              title="Still failing"
              description="Failing in both runs — still open."
              tone="amber"
              icon={ShieldAlert}
              items={comparison.stillFailing}
              emptyText="No check failed in both runs."
            />

            {(comparison.improved.length > 0 || comparison.worsened.length > 0) && (
              <ChangeList
                title="Partially addressed or back under review"
                description="Moved into or out of “needs review” without fully passing or failing."
                tone="slate"
                icon={Minus}
                items={[...comparison.improved, ...comparison.worsened]}
                emptyText=""
              />
            )}

            {comparison.otherChanges.length > 0 && (
              <ChangeList
                title="Other answer changes"
                description="Any other change, including a check marked N/A or reset to unchecked."
                tone="slate"
                icon={Info}
                items={comparison.otherChanges}
                emptyText=""
              />
            )}

            {(comparison.onlyInBase.length > 0 || comparison.onlyInHead.length > 0) && (
              <Card className="p-5">
                <h2 className="text-base font-semibold text-slate-900">Not comparable</h2>
                <p className="mt-1 text-sm text-slate-500">
                  These checks were not in both runs, so they are left out of the comparison — usually the
                  checklist or the project’s website type changed between runs.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {comparison.onlyInBase.map((item) => (
                    <li key={`base-${item.id}`}>
                      <span className="font-semibold">{item.title}</span> — only in the earlier run (
                      {STATUS_LABELS[item.status]})
                    </li>
                  ))}
                  {comparison.onlyInHead.map((item) => (
                    <li key={`head-${item.id}`}>
                      <span className="font-semibold">{item.title}</span> — only in the later run (
                      {STATUS_LABELS[item.status]})
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <p className="mt-8 flex items-start gap-2 text-xs text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This comparison is a straight diff of the answers you recorded in each run, scored by the same
            fixed rule set. Nothing was measured automatically.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryPanel({ comparison }: { comparison: QaComparison }) {
  const { score, readiness, counts } = comparison;
  const scoreDelta = score.delta;

  return (
    <Card className="mt-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">QA Readiness Score</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-500">{score.base === null ? '—' : score.base}</span>
            <ArrowRight className="mb-1.5 h-4 w-4 text-slate-400" />
            <span className="text-4xl font-bold text-slate-900">{score.head === null ? '—' : score.head}</span>
            {scoreDelta !== null && (
              <span
                className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                  scoreDelta > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : scoreDelta < 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {scoreDelta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : scoreDelta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
              </span>
            )}
          </div>
          {scoreDelta === null && (
            <p className="mt-1 text-xs text-slate-500">
              Not comparable — one of these runs has no score yet.
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Completion {comparison.completion.base}% → {comparison.completion.head}%
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${READINESS_STYLES[readiness.base]}`}>
            {READINESS_LABELS[readiness.base]}
          </span>
          {readiness.direction === 'improved' ? (
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          ) : readiness.direction === 'worsened' ? (
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          ) : (
            <ArrowRight className="h-4 w-4 text-slate-400" />
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${READINESS_STYLES[readiness.head]}`}>
            {READINESS_LABELS[readiness.head]}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Newly fixed" value={comparison.fixed.length} tone="text-emerald-600" />
        <Stat label="Newly broken" value={comparison.broken.length} tone="text-red-600" />
        <Stat label="Still failing" value={comparison.stillFailing.length} tone="text-amber-600" />
        <Stat
          label="Checks compared"
          value={comparison.totals.comparable}
          tone="text-slate-700"
          hint={`${comparison.totals.changed} changed`}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CountDeltaCell label="Passed" data={counts.passed} />
        <CountDeltaCell label="Failed" data={counts.failed} />
        <CountDeltaCell label="Needs review" data={counts.needsReview} />
        <CountDeltaCell label="N/A" data={counts.notApplicable} />
        <CountDeltaCell label="Not checked" data={counts.notChecked} />
        <CountDeltaCell label="Critical failures" data={counts.criticalFailures} />
      </dl>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
        Each count shows the earlier run → the later run.
      </p>
    </Card>
  );
}

const TONES: Record<string, { card: string; heading: string; badge: string }> = {
  emerald: { card: 'border-emerald-200', heading: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  red: { card: 'border-red-200', heading: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  amber: { card: 'border-amber-200', heading: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  slate: { card: '', heading: 'text-slate-700', badge: 'bg-slate-100 text-slate-600' },
};

function ChangeList({
  title,
  description,
  items,
  tone,
  icon: Icon,
  emptyText,
}: {
  title: string;
  description: string;
  items: QaItemChange[];
  tone: keyof typeof TONES;
  icon: typeof CheckCircle2;
  emptyText: string;
}) {
  const styles = TONES[tone];

  return (
    <Card className={`p-5 ${styles.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`flex items-center gap-2 text-base font-semibold ${styles.heading}`}>
          <Icon className="h-4 w-4" />
          {title}
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${styles.badge}`}>{items.length}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_STYLES[item.severity]}`}
                >
                  {SEVERITY_LABELS[item.severity]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.categoryName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[item.from]}`}>
                  {STATUS_LABELS[item.from]}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[item.to]}`}>
                  {STATUS_LABELS[item.to]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: number; tone: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function CountDeltaCell({
  label,
  data,
}: {
  label: string;
  data: { base: number; head: number; delta: number };
}) {
  const tone = data.delta === 0 ? 'text-slate-500' : data.delta > 0 ? 'text-slate-900' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-sm font-bold ${tone}`}>
        {data.base} → {data.head}
        <span className="ml-1 text-xs font-semibold text-slate-400">
          ({data.delta > 0 ? `+${data.delta}` : data.delta})
        </span>
      </dd>
    </div>
  );
}

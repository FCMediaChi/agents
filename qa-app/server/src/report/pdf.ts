/**
 * PDF report renderer (pdf-lib + fontkit, pure JavaScript — no headless browser).
 *
 * A4, 48 pt margins, automatic pagination with a footer on every page. The layout is drawn
 * by hand rather than by CSS, which is the price of not shipping a browser: the content is
 * identical to the HTML report (both come from the same model), the layout is simpler.
 */

import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFont, REPORT_FONTS } from './fonts.js';
import {
  formatReportDate,
  formatReportDateTime,
  type QaReportModel,
  type ReportFinding,
} from './model.js';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 34;

const BRAND = rgb(0.102, 0.62, 0.949); // #1A9EF2
const BRAND_SECONDARY = rgb(0.271, 0.318, 0.827); // #4551D3
const BRAND_ACCENT = rgb(0.427, 0.78, 1); // #6DC7FF
const BRAND_LIGHT = rgb(0.765, 0.91, 1); // #C3E8FF
const INK = rgb(0.059, 0.09, 0.165);
const MUTED = rgb(0.353, 0.42, 0.51);
const LINE = rgb(0.886, 0.91, 0.941);
const SOFT = rgb(0.973, 0.98, 0.988);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.02, 0.588, 0.412);
const RED = rgb(0.729, 0.149, 0.149);
const AMBER = rgb(0.706, 0.325, 0.035);

const READINESS_PALETTE: Record<string, { fg: RGB; bg: RGB }> = {
  not_started: { fg: rgb(0.278, 0.333, 0.408), bg: rgb(0.945, 0.961, 0.976) },
  not_ready: { fg: rgb(0.725, 0.11, 0.11), bg: rgb(0.996, 0.886, 0.886) },
  needs_attention: { fg: rgb(0.706, 0.325, 0.035), bg: rgb(0.996, 0.949, 0.78) },
  nearly_ready: { fg: BRAND_SECONDARY, bg: BRAND_LIGHT },
  ready: { fg: rgb(0.016, 0.471, 0.341), bg: rgb(0.82, 0.98, 0.898) },
};

const SEVERITY_PALETTE: Record<string, { fg: RGB; bg: RGB }> = {
  critical: { fg: rgb(0.725, 0.11, 0.11), bg: rgb(0.996, 0.886, 0.886) },
  high: { fg: rgb(0.706, 0.325, 0.035), bg: rgb(0.996, 0.949, 0.78) },
  medium: { fg: BRAND_SECONDARY, bg: rgb(0.878, 0.894, 0.984) },
  low: { fg: rgb(0.278, 0.333, 0.408), bg: rgb(0.945, 0.961, 0.976) },
};

/** pdf-lib's WinAnsi-ish encoding cannot represent astral characters (emoji, flags). */
function sanitize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface Context {
  doc: PDFDocument;
  page: PDFPage;
  /** Distance from the top of the page to the next line. */
  cursor: number;
  heading: PDFFont;
  body: PDFFont;
  medium: PDFFont;
  pages: PDFPage[];
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitize(text);
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushWord = (word: string) => {
    // Hard-split words that are wider than the line (long URLs, no spaces).
    let candidate = word;
    while (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      let cut = candidate.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(candidate.slice(0, cut), size) > maxWidth) cut -= 1;
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(candidate.slice(0, cut));
      candidate = candidate.slice(cut);
    }
    if (!candidate) return;
    const next = current ? `${current} ${candidate}` : candidate;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = candidate;
    }
  };

  for (const word of words) pushWord(word);
  if (current) lines.push(current);
  return lines;
}

function newPage(ctx: Context, withHeader = true): void {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.page = page;
  ctx.pages.push(page);
  ctx.cursor = MARGIN;

  if (withHeader) {
    page.drawText(sanitize('Nuria AI · Design QA Assistant'), {
      x: MARGIN,
      y: PAGE_H - MARGIN + 8,
      size: 7,
      font: ctx.medium,
      color: MUTED,
    });
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_H - MARGIN,
      width: CONTENT_W,
      height: 0.6,
      color: LINE,
    });
    ctx.cursor = MARGIN + 18;
  }
}

function ensureSpace(ctx: Context, height: number): void {
  if (ctx.cursor + height > PAGE_H - MARGIN - FOOTER_H) newPage(ctx);
}

function drawText(
  ctx: Context,
  text: string,
  options: {
    size: number;
    font?: PDFFont;
    color?: RGB;
    x?: number;
    maxWidth?: number;
    lineHeight?: number;
    spacingAfter?: number;
    align?: 'left' | 'right';
  },
): void {
  const font = options.font ?? ctx.body;
  const size = options.size;
  const x = options.x ?? MARGIN;
  const maxWidth = options.maxWidth ?? CONTENT_W - (x - MARGIN);
  const lineHeight = options.lineHeight ?? size * 1.36;
  const color = options.color ?? INK;
  const lines = wrap(text, font, size, maxWidth);
  if (!lines.length) return;

  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    const lineWidth = font.widthOfTextAtSize(line, size);
    const drawX = options.align === 'right' ? x + maxWidth - lineWidth : x;
    ctx.page.drawText(line, { x: drawX, y: PAGE_H - ctx.cursor - size, size, font, color });
    ctx.cursor += lineHeight;
  }
  if (options.spacingAfter) ctx.cursor += options.spacingAfter;
}

function sectionHeading(ctx: Context, title: string, count?: number, tone?: RGB): void {
  ensureSpace(ctx, 34);
  ctx.cursor += 8;
  const baseline = PAGE_H - ctx.cursor - 12.5;
  ctx.page.drawText(sanitize(title), {
    x: MARGIN,
    y: baseline,
    size: 12.5,
    font: ctx.heading,
    color: INK,
  });
  if (count !== undefined) {
    const value = String(count);
    const width = ctx.heading.widthOfTextAtSize(value, 12.5);
    ctx.page.drawText(value, {
      x: MARGIN + CONTENT_W - width,
      y: baseline,
      size: 12.5,
      font: ctx.heading,
      color: tone ?? MUTED,
    });
  }
  ctx.cursor += 12.5 * 1.36 + 1;
}

function chip(
  ctx: Context,
  label: string,
  palette: { fg: RGB; bg: RGB },
  x: number,
  top: number,
  size = 6.5,
): number {
  const text = sanitize(label).toUpperCase();
  const width = ctx.medium.widthOfTextAtSize(text, size) + 12;
  const height = size + 7;
  ctx.page.drawRectangle({ x, y: PAGE_H - top - height, width, height, color: palette.bg });
  ctx.page.drawText(text, {
    x: x + 6,
    y: PAGE_H - top - height + 3.5,
    size,
    font: ctx.medium,
    color: palette.fg,
  });
  return width;
}

function drawCover(ctx: Context, model: QaReportModel): void {
  const page = ctx.page;
  const bandH = 168;

  // Simulated brand gradient: thin vertical strips from secondary to accent.
  const strips = 80;
  const stripW = PAGE_W / strips;
  for (let i = 0; i < strips; i += 1) {
    const t = i / (strips - 1);
    const from = t < 0.6 ? BRAND_SECONDARY : BRAND;
    const to = t < 0.6 ? BRAND : BRAND_ACCENT;
    const local = t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4;
    page.drawRectangle({
      x: i * stripW,
      y: PAGE_H - bandH,
      width: stripW + 0.6,
      height: bandH,
      color: rgb(lerp(from.red, to.red, local), lerp(from.green, to.green, local), lerp(from.blue, to.blue, local)),
    });
  }

  // Brand mark + wordmark
  page.drawRectangle({ x: MARGIN, y: PAGE_H - 44, width: 18, height: 18, color: WHITE });
  page.drawRectangle({ x: MARGIN + 4, y: PAGE_H - 40, width: 10, height: 10, color: BRAND_SECONDARY });
  page.drawText(sanitize('Nuria AI'), {
    x: MARGIN + 26,
    y: PAGE_H - 40,
    size: 14,
    font: ctx.heading,
    color: WHITE,
  });
  const product = sanitize(model.brand.product).toUpperCase();
  const productWidth = ctx.medium.widthOfTextAtSize(product, 7);
  page.drawText(product, {
    x: PAGE_W - MARGIN - productWidth,
    y: PAGE_H - 38,
    size: 7,
    font: ctx.medium,
    color: WHITE,
  });

  page.drawText(sanitize('QA Readiness Report'), {
    x: MARGIN,
    y: PAGE_H - 92,
    size: 26,
    font: ctx.heading,
    color: WHITE,
  });
  page.drawText(sanitize(model.project.name), {
    x: MARGIN,
    y: PAGE_H - 114,
    size: 12.5,
    font: ctx.medium,
    color: WHITE,
  });

  const metaParts = [
    model.project.clientName ? `Client: ${sanitize(model.project.clientName)}` : '',
    model.project.websiteUrl ? `Website: ${sanitize(model.project.websiteUrl)}` : '',
    `Site type: ${sanitize(model.project.websiteType)}`,
    `Platform: ${sanitize(model.project.platform)}`,
    `Run: ${sanitize(model.run.label)}`,
    `Run date: ${formatReportDate(model.run.startedAt)}`,
  ].filter(Boolean);

  let metaX = MARGIN;
  let metaY = PAGE_H - 136;
  for (const part of metaParts) {
    const width = ctx.body.widthOfTextAtSize(part, 8);
    if (metaX + width > PAGE_W - MARGIN) {
      metaX = MARGIN;
      metaY -= 13;
    }
    page.drawText(part, { x: metaX, y: metaY, size: 8, font: ctx.body, color: WHITE });
    metaX += width + 16;
  }

  ctx.cursor = bandH + 26;
}

function drawScoreBlock(ctx: Context, model: QaReportModel): void {
  const palette = READINESS_PALETTE[model.run.readiness.status] ?? READINESS_PALETTE.not_started;
  const cardW = (CONTENT_W - 14) / 2;
  const cardH = 132;
  ensureSpace(ctx, cardH + 10);
  const top = ctx.cursor;

  for (const [index, x] of [MARGIN, MARGIN + cardW + 14].entries()) {
    ctx.page.drawRectangle({
      x,
      y: PAGE_H - top - cardH,
      width: cardW,
      height: cardH,
      borderColor: LINE,
      borderWidth: 0.8,
      color: index === 0 ? SOFT : WHITE,
    });
  }

  // Left card: score + readiness gate
  ctx.page.drawText(sanitize('QA READINESS SCORE'), {
    x: MARGIN + 16,
    y: PAGE_H - top - 22,
    size: 6.5,
    font: ctx.medium,
    color: MUTED,
  });
  const scoreText = model.run.score === null ? '—' : String(model.run.score);
  ctx.page.drawText(sanitize(scoreText), {
    x: MARGIN + 16,
    y: PAGE_H - top - 58,
    size: 34,
    font: ctx.heading,
    color: INK,
  });
  const scoreWidth = ctx.heading.widthOfTextAtSize(sanitize(scoreText), 34);
  ctx.page.drawText('/100', {
    x: MARGIN + 20 + scoreWidth,
    y: PAGE_H - top - 56,
    size: 10,
    font: ctx.heading,
    color: MUTED,
  });

  chip(ctx, model.run.readiness.label, palette, MARGIN + 16, top + 62, 7.5);
  const reasonLines = wrap(model.run.readiness.reason, ctx.body, 7.5, cardW - 32);
  let reasonTop = top + 82;
  for (const line of reasonLines.slice(0, 3)) {
    ctx.page.drawText(line, {
      x: MARGIN + 16,
      y: PAGE_H - reasonTop - 7.5,
      size: 7.5,
      font: ctx.body,
      color: MUTED,
    });
    reasonTop += 10;
  }

  // Right card: completion
  const rightX = MARGIN + cardW + 14 + 16;
  ctx.page.drawText(sanitize('CHECKLIST COMPLETION'), {
    x: rightX,
    y: PAGE_H - top - 22,
    size: 6.5,
    font: ctx.medium,
    color: MUTED,
  });
  ctx.page.drawText(`${model.run.completionPercentage}%`, {
    x: rightX,
    y: PAGE_H - top - 56,
    size: 26,
    font: ctx.heading,
    color: INK,
  });
  const answered =
    model.counts.passed + model.counts.failed + model.counts.needsReview + model.counts.notApplicable;
  ctx.page.drawText(
    sanitize(`${answered} of ${model.counts.total} applicable checks answered`),
    { x: rightX, y: PAGE_H - top - 72, size: 7.5, font: ctx.body, color: MUTED },
  );

  const trackW = cardW - 32;
  const trackTop = top + 88;
  ctx.page.drawRectangle({
    x: rightX,
    y: PAGE_H - trackTop - 7,
    width: trackW,
    height: 7,
    color: rgb(0.933, 0.949, 0.969),
  });
  const fillW = Math.max(0, Math.min(100, model.run.completionPercentage)) * (trackW / 100);
  if (fillW > 0) {
    ctx.page.drawRectangle({
      x: rightX,
      y: PAGE_H - trackTop - 7,
      width: fillW,
      height: 7,
      color: palette.fg,
    });
  }
  ctx.page.drawText(
    sanitize(model.run.completedAt
      ? `Completed ${formatReportDate(model.run.completedAt)}`
      : 'Not every check has been answered yet'),
    { x: rightX, y: PAGE_H - top - 116, size: 7.5, font: ctx.body, color: MUTED },
  );

  ctx.cursor = top + cardH + 16;
}

function drawCounts(ctx: Context, model: QaReportModel): void {
  const tiles: Array<{ label: string; value: number; tone: RGB }> = [
    { label: 'PASSED', value: model.counts.passed, tone: GREEN },
    { label: 'FAILED', value: model.counts.failed, tone: RED },
    { label: 'NEEDS REVIEW', value: model.counts.needsReview, tone: AMBER },
    { label: 'N/A', value: model.counts.notApplicable, tone: MUTED },
    { label: 'NOT CHECKED', value: model.counts.notChecked, tone: MUTED },
    { label: 'CRITICAL FAILS', value: model.counts.criticalFailures, tone: model.counts.criticalFailures ? RED : MUTED },
  ];

  const gap = 8;
  const tileW = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const tileH = 44;
  ensureSpace(ctx, tileH + 8);
  const top = ctx.cursor;

  tiles.forEach((tile, index) => {
    const x = MARGIN + index * (tileW + gap);
    ctx.page.drawRectangle({
      x,
      y: PAGE_H - top - tileH,
      width: tileW,
      height: tileH,
      color: SOFT,
      borderColor: LINE,
      borderWidth: 0.6,
    });
    ctx.page.drawText(sanitize(tile.label), {
      x: x + 8,
      y: PAGE_H - top - 15,
      size: 5.8,
      font: ctx.medium,
      color: MUTED,
    });
    ctx.page.drawText(String(tile.value), {
      x: x + 8,
      y: PAGE_H - top - 34,
      size: 15,
      font: ctx.heading,
      color: tile.tone,
    });
  });

  ctx.cursor = top + tileH + 10;
}

function drawCategories(ctx: Context, model: QaReportModel): void {
  sectionHeading(ctx, 'Score by category');
  drawText(ctx, 'Each category is scored the same way as the whole checklist.', {
    size: 7.5,
    color: MUTED,
    spacingAfter: 6,
  });

  for (const category of model.categories) {
    const rowH = 34;
    ensureSpace(ctx, rowH);
    const top = ctx.cursor;

    drawText(ctx, category.name, { size: 9, font: ctx.heading, color: INK });
    if (category.description) {
      drawText(ctx, category.description, { size: 7, color: MUTED });
    } else {
      ctx.cursor += 1;
    }

    const counts = `${category.counts.passed} pass · ${category.counts.failed} fail · ${category.counts.needsReview} review`;
    const countsWidth = ctx.body.widthOfTextAtSize(sanitize(counts), 7.5);
    ctx.page.drawText(sanitize(counts), {
      x: MARGIN + CONTENT_W - countsWidth,
      y: PAGE_H - top - 9,
      size: 7.5,
      font: ctx.body,
      color: MUTED,
    });

    const barTop = top + 20;
    const barW = 150;
    ctx.page.drawRectangle({
      x: MARGIN,
      y: PAGE_H - barTop - 6,
      width: barW,
      height: 6,
      color: rgb(0.933, 0.949, 0.969),
    });
    const score = category.score;
    if (score !== null && score > 0) {
      ctx.page.drawRectangle({
        x: MARGIN,
        y: PAGE_H - barTop - 6,
        width: barW * (Math.min(100, score) / 100),
        height: 6,
        color: BRAND,
      });
    }
    const scoreLabel = score === null ? 'No score yet' : `${score}% passed`;
    ctx.page.drawText(sanitize(scoreLabel), {
      x: MARGIN + barW + 10,
      y: PAGE_H - barTop - 5,
      size: 7.5,
      font: ctx.medium,
      color: score === null ? MUTED : INK,
    });
    const completionLabel = `${category.completionPercentage}% answered`;
    const completionWidth = ctx.body.widthOfTextAtSize(sanitize(completionLabel), 7.5);
    ctx.page.drawText(sanitize(completionLabel), {
      x: MARGIN + CONTENT_W - completionWidth,
      y: PAGE_H - barTop - 5,
      size: 7.5,
      font: ctx.body,
      color: MUTED,
    });

    ctx.cursor = top + rowH;
    ctx.page.drawRectangle({
      x: MARGIN,
      y: PAGE_H - ctx.cursor + 4,
      width: CONTENT_W,
      height: 0.6,
      color: LINE,
    });
  }
  ctx.cursor += 4;
}

function drawFinding(ctx: Context, finding: ReportFinding, tone: RGB): void {
  ensureSpace(ctx, 46);
  const palette = SEVERITY_PALETTE[finding.severity] ?? SEVERITY_PALETTE.low;
  const top = ctx.cursor;

  // Accent bar
  ctx.page.drawRectangle({ x: MARGIN, y: PAGE_H - top - 8, width: 2.4, height: 8, color: tone });
  const chipWidth = chip(ctx, finding.severityLabel, palette, MARGIN + 9, top - 1, 6);

  drawText(ctx, finding.title, {
    size: 9,
    font: ctx.heading,
    color: INK,
    x: MARGIN + 9 + chipWidth + 8,
    maxWidth: CONTENT_W - (9 + chipWidth + 8),
  });
  drawText(ctx, `${finding.categoryName} · ${finding.statusLabel}`, {
    size: 7.5,
    color: MUTED,
    x: MARGIN + 9,
  });

  const noteText = finding.notes ?? 'No notes recorded for this check.';
  const noteLines = wrap(noteText, ctx.body, 8, CONTENT_W - 30);
  const noteH = 16 + noteLines.length * 11;
  const pageContentHeight = PAGE_H - 2 * MARGIN - FOOTER_H;
  ensureSpace(ctx, Math.min(noteH, pageContentHeight) + 16);

  const noteTop = ctx.cursor + 3;
  const boxHeight = Math.min(noteH, pageContentHeight);
  ctx.page.drawRectangle({
    x: MARGIN + 9,
    y: PAGE_H - noteTop - boxHeight,
    width: CONTENT_W - 9,
    height: boxHeight,
    color: SOFT,
  });
  ctx.page.drawText(sanitize('REVIEWER NOTES'), {
    x: MARGIN + 17,
    y: PAGE_H - noteTop - 11,
    size: 5.8,
    font: ctx.medium,
    color: MUTED,
  });
  ctx.cursor = noteTop + 13;
  for (const line of noteLines) {
    ensureSpace(ctx, 11);
    ctx.page.drawText(line, {
      x: MARGIN + 17,
      y: PAGE_H - ctx.cursor - 8,
      size: 8,
      font: ctx.body,
      color: finding.notes ? INK : MUTED,
    });
    ctx.cursor += 11;
  }

  if (finding.remediation) {
    ctx.cursor += 2;
    drawText(ctx, `How to check: ${finding.remediation}`, {
      size: 7.5,
      color: MUTED,
      x: MARGIN + 9,
    });
  }

  ctx.cursor += 10;
}

function drawMovementList(
  ctx: Context,
  title: string,
  items: ReportFinding[],
  tone: RGB,
  emptyText: string,
  columnX: number,
  columnW: number,
): void {
  const top = ctx.cursor;
  ctx.page.drawText(sanitize(title.toUpperCase()), {
    x: columnX,
    y: PAGE_H - top - 8,
    size: 6,
    font: ctx.medium,
    color: MUTED,
  });
  ctx.page.drawText(String(items.length), {
    x: columnX + columnW - ctx.heading.widthOfTextAtSize(String(items.length), 8),
    y: PAGE_H - top - 9,
    size: 8,
    font: ctx.heading,
    color: tone,
  });
  ctx.cursor = top + 14;

  if (!items.length) {
    drawText(ctx, emptyText, { size: 7, color: MUTED, x: columnX, maxWidth: columnW });
    ctx.cursor += 2;
    return;
  }

  // Columns are drawn side by side from a shared top, so cap the list length rather than
  // let one column paginate under the other.
  const visible = items.slice(0, 10);
  for (const item of visible) {
    ensureSpace(ctx, 20);
    ctx.page.drawRectangle({
      x: columnX,
      y: PAGE_H - ctx.cursor - 5,
      width: 2,
      height: 5,
      color: tone,
    });
    drawText(ctx, item.title, { size: 7.5, x: columnX + 7, maxWidth: columnW - 7, color: INK });
    drawText(ctx, `${item.categoryName} · ${item.severityLabel}`, {
      size: 6.5,
      x: columnX + 7,
      maxWidth: columnW - 7,
      color: MUTED,
    });
    ctx.cursor += 3;
  }

  if (items.length > visible.length) {
    drawText(ctx, `and ${items.length - visible.length} more`, {
      size: 6.5,
      x: columnX + 7,
      maxWidth: columnW - 7,
      color: MUTED,
    });
  }
}

function drawComparison(ctx: Context, model: QaReportModel): void {
  const comparison = model.comparison;
  if (!comparison) return;

  newPage(ctx);
  sectionHeading(ctx, 'Compared with an earlier run');
  drawText(
    ctx,
    'This run is the later one. The movement below comes from the same scoring engine as the app.',
    { size: 7.5, color: MUTED, spacingAfter: 8 },
  );

  const cardW = (CONTENT_W - 40) / 2;
  const cardH = 78;
  ensureSpace(ctx, cardH + 8);
  const top = ctx.cursor;

  const sides = [
    { side: comparison.base, label: 'EARLIER RUN', x: MARGIN, highlight: false },
    { side: comparison.head, label: 'THIS RUN', x: MARGIN + cardW + 40, highlight: true },
  ];

  for (const entry of sides) {
    ctx.page.drawRectangle({
      x: entry.x,
      y: PAGE_H - top - cardH,
      width: cardW,
      height: cardH,
      color: entry.highlight ? rgb(0.949, 0.98, 1) : SOFT,
      borderColor: entry.highlight ? BRAND_LIGHT : LINE,
      borderWidth: 0.8,
    });
    ctx.page.drawText(sanitize(entry.label), {
      x: entry.x + 14,
      y: PAGE_H - top - 16,
      size: 5.8,
      font: ctx.medium,
      color: MUTED,
    });
    ctx.page.drawText(sanitize(entry.side.label), {
      x: entry.x + 14,
      y: PAGE_H - top - 30,
      size: 9,
      font: ctx.heading,
      color: INK,
    });
    ctx.page.drawText(formatReportDate(entry.side.startedAt), {
      x: entry.x + 14,
      y: PAGE_H - top - 42,
      size: 7,
      font: ctx.body,
      color: MUTED,
    });
    const scoreText = entry.side.score === null ? '—' : String(entry.side.score);
    ctx.page.drawText(scoreText, {
      x: entry.x + 14,
      y: PAGE_H - top - 66,
      size: 16,
      font: ctx.heading,
      color: INK,
    });
    const scoreWidth = ctx.heading.widthOfTextAtSize(scoreText, 16);
    ctx.page.drawText('/100', {
      x: entry.x + 18 + scoreWidth,
      y: PAGE_H - top - 65,
      size: 7,
      font: ctx.body,
      color: MUTED,
    });
    ctx.page.drawText(sanitize(entry.side.readinessLabel), {
      x: entry.x + 14 + scoreWidth + 16,
      y: PAGE_H - top - 62,
      size: 8,
      font: ctx.medium,
      color: BRAND_SECONDARY,
    });
  }

  // Arrow between the cards (drawn, not a glyph — no font coverage to depend on)
  const arrowX = MARGIN + cardW + 16;
  const arrowY = PAGE_H - top - 40;
  ctx.page.drawLine({ start: { x: arrowX, y: arrowY }, end: { x: arrowX + 8, y: arrowY }, thickness: 1.2, color: BRAND });
  ctx.page.drawLine({ start: { x: arrowX + 4.5, y: arrowY + 3 }, end: { x: arrowX + 8, y: arrowY }, thickness: 1.2, color: BRAND });
  ctx.page.drawLine({ start: { x: arrowX + 4.5, y: arrowY - 3 }, end: { x: arrowX + 8, y: arrowY }, thickness: 1.2, color: BRAND });

  ctx.cursor = top + cardH + 12;

  const direction =
    comparison.readinessDirection === 'improved'
      ? 'Launch readiness improved'
      : comparison.readinessDirection === 'worsened'
        ? 'Launch readiness got worse'
        : 'Launch readiness is unchanged';
  const scoreDelta =
    comparison.scoreDelta === null
      ? 'not comparable'
      : comparison.scoreDelta === 0
        ? 'no change'
        : `${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta}`;
  const completionDelta =
    comparison.completionDelta === null
      ? 'not comparable'
      : comparison.completionDelta === 0
        ? 'no change'
        : `${comparison.completionDelta > 0 ? '+' : ''}${comparison.completionDelta}%`;

  drawText(
    ctx,
    `Score ${scoreDelta} · Completion ${completionDelta} · ${direction} · ${comparison.totals.comparable} checks comparable, ${comparison.totals.changed} changed.`,
    { size: 8, font: ctx.medium, color: INK, spacingAfter: 12 },
  );

  const columnW = (CONTENT_W - 24) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + columnW + 24;

  // Both columns are drawn from the same top, so give them room to finish on one page.
  ensureSpace(ctx, 300);
  const leftTop = ctx.cursor;
  drawMovementList(ctx, 'Fixed since the earlier run', comparison.fixed, GREEN, 'Nothing was fixed between these runs.', leftX, columnW);
  const leftBottom = ctx.cursor;

  ctx.cursor = leftTop;
  drawMovementList(ctx, 'Broken since the earlier run', comparison.broken, RED, 'Nothing that passed before is failing now.', rightX, columnW);
  const rightBottom = ctx.cursor;

  ctx.cursor = Math.max(leftBottom, rightBottom) + 14;

  const improvedTop = ctx.cursor;
  drawMovementList(ctx, 'Partly addressed', comparison.improved, MUTED, 'No failing check moved to needs-review.', leftX, columnW);
  const improvedBottom = ctx.cursor;

  ctx.cursor = improvedTop;
  drawMovementList(ctx, 'Now needs a look', comparison.worsened, MUTED, 'No passing check moved to needs-review.', rightX, columnW);
  const worsenedBottom = ctx.cursor;

  ctx.cursor = Math.max(improvedBottom, worsenedBottom) + 12;

  drawText(
    ctx,
    `${comparison.stillFailing.length} ${comparison.stillFailing.length === 1 ? 'check is' : 'checks are'} still failing in both runs.`,
    { size: 7.5, color: MUTED },
  );
}

function drawMethod(ctx: Context, model: QaReportModel): void {
  ensureSpace(ctx, 90);
  ctx.cursor += 6;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - ctx.cursor,
    width: CONTENT_W,
    height: 0.8,
    color: LINE,
  });
  ctx.cursor += 14;
  drawText(ctx, 'How the score is calculated', { size: 10, font: ctx.heading, spacingAfter: 4 });
  drawText(
    ctx,
    'Each check carries a weight from its severity: critical 5, high 3, medium 2, low 1. A passed check earns its full weight, a check that needs review earns half, a failed check earns nothing. Checks marked N/A and checks not yet answered are left out of the calculation entirely.',
    { size: 7.5, color: MUTED, spacingAfter: 5 },
  );
  drawText(
    ctx,
    'The QA Readiness Score is the earned weight divided by the weight of every check that was reviewed. Launch readiness is decided separately by fixed rules: any failed critical check means "Not ready"; a failed high check, an unreviewed critical or high check, or a score below 70 means "Needs attention"; a score below 90, or any unreviewed lower-priority check, means "Nearly ready"; and only a run with every check reviewed, no critical or high failures and a score of at least 90 is "Ready for launch".',
    { size: 7.5, color: MUTED, spacingAfter: 5 },
  );
  drawText(
    ctx,
    `This is a checklist-weighted readiness indicator based on the reviewer's own answers, not an automated measurement of the live site. Report generated ${formatReportDateTime(model.generatedAt)}.`,
    { size: 7.5, color: MUTED },
  );
}

function drawFooters(ctx: Context, model: QaReportModel): void {
  const total = ctx.pages.length;
  ctx.pages.forEach((page, index) => {
    page.drawRectangle({
      x: MARGIN,
      y: FOOTER_H - 8,
      width: CONTENT_W,
      height: 0.6,
      color: LINE,
    });
    page.drawText(sanitize(`${model.brand.name} · ${model.brand.product}`), {
      x: MARGIN,
      y: FOOTER_H - 22,
      size: 6.5,
      font: ctx.body,
      color: MUTED,
    });
    const pageLabel = `Page ${index + 1} of ${total}`;
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN - ctx.body.widthOfTextAtSize(pageLabel, 6.5),
      y: FOOTER_H - 22,
      size: 6.5,
      font: ctx.body,
      color: MUTED,
    });
  });
}

export async function renderReportPdf(model: QaReportModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const heading = await doc.embedFont(readFont(REPORT_FONTS.heading), { subset: true });
  const body = await doc.embedFont(readFont(REPORT_FONTS.body), { subset: true });
  const medium = await doc.embedFont(readFont(REPORT_FONTS.bodyMedium), { subset: true });

  const firstPage = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Context = {
    doc,
    page: firstPage,
    cursor: MARGIN,
    heading,
    body,
    medium,
    pages: [firstPage],
  };

  drawCover(ctx, model);
  drawScoreBlock(ctx, model);
  drawCounts(ctx, model);
  drawCategories(ctx, model);

  sectionHeading(ctx, 'Failing checks', model.findings.failures.length, RED);
  drawText(ctx, 'Most serious first. These are the checks that failed in this run.', {
    size: 7.5,
    color: MUTED,
    spacingAfter: 6,
  });
  if (model.findings.failures.length) {
    for (const finding of model.findings.failures) drawFinding(ctx, finding, RED);
  } else {
    drawText(ctx, 'No failing checks in this run.', { size: 8, color: MUTED, spacingAfter: 8 });
  }

  sectionHeading(ctx, 'Needs review', model.findings.needsReview.length, AMBER);
  drawText(ctx, 'Checks the reviewer flagged for a second look before launch.', {
    size: 7.5,
    color: MUTED,
    spacingAfter: 6,
  });
  if (model.findings.needsReview.length) {
    for (const finding of model.findings.needsReview) drawFinding(ctx, finding, AMBER);
  } else {
    drawText(ctx, 'No checks are waiting on a second look.', { size: 8, color: MUTED, spacingAfter: 8 });
  }

  drawComparison(ctx, model);
  drawMethod(ctx, model);
  drawFooters(ctx, model);

  doc.setTitle(sanitize(`QA Readiness Report — ${model.project.name}`));
  doc.setSubject(sanitize(`${model.brand.product} · ${model.run.label}`));
  doc.setAuthor(sanitize(model.brand.name));
  doc.setCreator(sanitize(model.brand.product));
  doc.setProducer(sanitize(model.brand.name));
  doc.setCreationDate(new Date(model.generatedAt));

  return doc.save();
}

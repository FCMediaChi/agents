import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { UpdateProposalSchema } from '../schemas/pages.js';
import { AuthenticatedRequest, Proposal, Project } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { requirePaidTier } from '../middleware/projectLimit.js';
import { exportRateLimit, exportCooldown } from '../middleware/abuseProtection.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/projects/:projectId/proposal
router.get('/:projectId/proposal', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user!.userId) as Project | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const proposal = db.prepare('SELECT * FROM proposals WHERE project_id = ?').get(projectId) as Proposal | undefined;

  if (!proposal) {
    // Return empty proposal structure if none exists yet
    res.json({
      id: null,
      project_id: projectId,
      client_name: '',
      executive_summary: null,
      pricing_estimate: null,
      timeline_weeks: 4,
      terms_conditions: null,
      status: 'draft',
      created_at: null,
      updated_at: null,
    });
    return;
  }

  res.json(proposal);
});

// PUT /api/projects/:projectId/proposal
router.put('/:projectId/proposal', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user!.userId) as Project | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = UpdateProposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  // Check if proposal exists
  const existing = db.prepare('SELECT id FROM proposals WHERE project_id = ?').get(projectId);

  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.client_name !== undefined) { updates.push('client_name = ?'); values.push(data.client_name); }
    if (data.executive_summary !== undefined) { updates.push('executive_summary = ?'); values.push(data.executive_summary); }
    if (data.pricing_estimate !== undefined) { updates.push('pricing_estimate = ?'); values.push(data.pricing_estimate); }
    if (data.timeline_weeks !== undefined) { updates.push('timeline_weeks = ?'); values.push(data.timeline_weeks); }
    if (data.terms_conditions !== undefined) { updates.push('terms_conditions = ?'); values.push(data.terms_conditions); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId);

    db.prepare(`UPDATE proposals SET ${updates.join(', ')} WHERE project_id = ?`).run(...values);
  } else {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO proposals (id, project_id, client_name, executive_summary, pricing_estimate, timeline_weeks, terms_conditions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      projectId,
      data.client_name || 'New Client',
      data.executive_summary ?? null,
      data.pricing_estimate ?? null,
      data.timeline_weeks ?? 4,
      data.terms_conditions ?? null,
      data.status ?? 'draft'
    );
  }

  const proposal = db.prepare('SELECT * FROM proposals WHERE project_id = ?').get(projectId) as Proposal;
  res.json(proposal);
});

// POST /api/projects/:projectId/proposal/export-doc
router.post('/:projectId/proposal/export-doc', exportRateLimit, exportCooldown, (req: AuthenticatedRequest, res: Response): void => {
  const { projectId } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user!.userId) as Project | undefined;
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const pages = db.prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order').all(projectId) as any[];
  const proposal = db.prepare('SELECT * FROM proposals WHERE project_id = ?').get(projectId) as any;

  const clientName = proposal?.client_name || 'Client';
  const summary = proposal?.executive_summary || 'No executive summary provided.';
  const pricing = proposal?.pricing_estimate || 'Not specified';
  const timeline = proposal?.timeline_weeks || 4;

  // Check blueprint whitelabel
  const bp = db.prepare('SELECT * FROM blueprint_whitelabel WHERE user_id = ? AND enabled = 1').get(req.user!.userId) as any;
  const bpPrimary = bp?.primary_color || project.branding_primary_color || '#1A9EF2';
  const bpSecondary = bp?.secondary_color || project.branding_secondary_color || '#4551D3';
  const bpCompany = bp?.company_name || '';
  const generatorBrand = bp ? bpCompany || 'Nuria Website Blueprint' : 'Nuria Website Blueprint';

  // Build sitemap list
  const sitemapItems = pages.map((p: any) => `<li><strong>${p.title}</strong> (${p.page_type}) — ${p.description || 'No description'}</li>`).join('');

  // Build page outlines with questionnaires
  const pageOutlines = pages.map((p: any) => {
    const q = db.prepare('SELECT questions, answers FROM questionnaires WHERE page_id = ?').get(p.id) as any;
    let qaHtml = '';
    if (q) {
      const questions = JSON.parse(q.questions || '[]');
      const answers = q.answers ? JSON.parse(q.answers) : {};
      qaHtml = questions.map((qst: string) => `<p><em>Q: ${qst}</em><br/><strong>A: ${answers[qst] || '(pending)'}</strong></p>`).join('');
    }
    return `<h3>${p.title} <span style="font-size:12px;color:#64748b">(${p.page_type})</span></h3>
<p>${p.description || ''}</p>
${p.goals ? `<p><strong>Goals:</strong> ${p.goals}</p>` : ''}
${qaHtml ? `<div style="margin:12px 0;padding:12px;background:#f8fafc;border-left:3px solid ${bpPrimary}">${qaHtml}</div>` : ''}`;
  }).join('<hr style="margin:20px 0"/>');

  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><title>${project.title} Proposal</title>
<style>
@page { margin: 1in; size: letter; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; font-size: 12pt; }
.cover { text-align: center; padding: 80px 0 40px; border-bottom: 2px solid ${bpPrimary}; margin-bottom: 40px; }
.cover h1 { font-size: 28pt; color: ${bpPrimary}; margin: 0 0 8px; }
.cover .sub { font-size: 14pt; color: #64748b; }
h2 { font-size: 18pt; color: ${bpPrimary}; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 32px 0 16px; }
h3 { font-size: 14pt; color: #334155; margin: 16px 0 8px; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
th { background: #f1f5f9; font-weight: 600; }
ul { margin: 8px 0; padding-left: 24px; }
li { margin: 4px 0; }
.footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10pt; color: #94a3b8; text-align: center; }
</style></head><body>
<div class="cover">
<h1>${project.title}</h1>
<div class="sub">Website Project Proposal</div>
<p style="margin-top:24px;font-size:11pt;color:#64748b">Prepared for: ${clientName}<br/>Prepared by: ${req.user!.email}</p>
</div>
<h2>1. Executive Summary</h2>
<p>${summary}</p>
<h2>2. Project Sitemap</h2>
<ul>${sitemapItems}</ul>
<h2>3. Page Outlines & Content</h2>
${pageOutlines}
<h2>4. Pricing Estimate</h2>
<p>${pricing}</p>
<h2>5. Timeline</h2>
<p>Estimated project timeline: <strong>${timeline} weeks</strong></p>
<h2>6. Terms & Conditions</h2>
<p>${proposal?.terms_conditions || 'Standard terms and conditions apply.'}</p>
<div class="footer">
Generated by ${generatorBrand} — ${new Date().toLocaleDateString()}
</div>
</body></html>`;

  res.setHeader('Content-Type', 'application/msword');
  res.setHeader('Content-Disposition', `attachment; filename="${project.title.replace(/\s+/g,'-')}-Proposal.doc"`);
  res.send(doc);
});

// ── Platform Exports (Agency only) ────────────────────────────

// POST /api/projects/:projectId/export/webflow
router.post('/:projectId/export/webflow', exportRateLimit, exportCooldown, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (userRec?.subscription_tier !== 'AGENCY') { res.status(402).json({ error: 'Agency tier required' }); return; }

  const pages = db.prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId) as any[];
  let csv = 'Name,Slug,Page Type,Description,Content Sections\n';
  for (const p of pages) {
    const q = db.prepare('SELECT questions, answers FROM questionnaires WHERE page_id = ?').get(p.id) as any;
    let content = p.notes || '';
    if (q) {
      const questions = JSON.parse(q.questions || '[]');
      const answers = q.answers ? JSON.parse(q.answers) : {};
      content += ' | ' + questions.map((qst: string) => `${qst}: ${answers[qst] || ''}`).join('; ');
    }
    csv += `"${(p.title || '').replace(/"/g,'""')}","${(p.slug || '').replace(/"/g,'""')}","${p.page_type}","${(p.description || '').replace(/"/g,'""')}","${content.replace(/"/g,'""')}"\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="webflow-export.csv"');
  res.send(csv);
});

// POST /api/projects/:projectId/export/wordpress
router.post('/:projectId/export/wordpress', exportRateLimit, exportCooldown, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (userRec?.subscription_tier !== 'AGENCY') { res.status(402).json({ error: 'Agency tier required' }); return; }

  const project = db.prepare('SELECT title FROM projects WHERE id = ?').get(req.params.projectId) as any;
  const pages = db.prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId) as any[];

  const items = pages.map((p: any) => {
    const q = db.prepare('SELECT questions, answers FROM questionnaires WHERE page_id = ?').get(p.id) as any;
    let content = `<h2>${p.title}</h2><p>${p.description || ''}</p>`;
    if (q) {
      const questions = JSON.parse(q.questions || '[]');
      const answers = q.answers ? JSON.parse(q.answers) : {};
      content += '<h3>Content Brief</h3><ul>' + questions.map((qst: string) => `<li><strong>${qst}</strong>: ${answers[qst] || ''}</li>`).join('') + '</ul>';
    }
    if (p.goals) content += `<p><em>Goals: ${p.goals}</em></p>`;
    return `<item><title>${p.title}</title><link>http://example.com/${p.slug || ''}</link><content:encoded><![CDATA[${content}]]></content:encoded><wp:post_type>page</wp:post_type><wp:status>draft</wp:status></item>`;
  }).join('\n');

  const wxr = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wp="http://wordpress.org/export/1.2/">
<channel><title>${project?.title || 'Website'}</title><link>http://example.com</link><description>WordPress Export</description>
${items}
</channel></rss>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="wordpress-export.xml"');
  res.send(wxr);
});

// POST /api/projects/:projectId/export/framer
router.post('/:projectId/export/framer', exportRateLimit, exportCooldown, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (userRec?.subscription_tier !== 'AGENCY') { res.status(402).json({ error: 'Agency tier required' }); return; }

  const project = db.prepare('SELECT title FROM projects WHERE id = ?').get(req.params.projectId) as any;
  const pages = db.prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId) as any[];

  const framerPages = pages.map((p: any) => {
    const wireframe = db.prepare('SELECT blocks FROM wireframes WHERE page_id = ?').get(p.id) as any;
    const blocks: any[] = wireframe ? JSON.parse(wireframe.blocks) : [];
    const sections = blocks.map((b: any) => ({ type: b.type, name: b.title, subtitle: b.subtitle || '', content: b.content || '' }));
    const q = db.prepare('SELECT questions, answers FROM questionnaires WHERE page_id = ?').get(p.id) as any;
    let contentBrief: Record<string, string> = {};
    if (q) {
      const questions = JSON.parse(q.questions || '[]');
      const answers = q.answers ? JSON.parse(q.answers) : {};
      questions.forEach((qst: string) => { contentBrief[qst] = answers[qst] || ''; });
    }
    return { name: p.title, slug: p.slug, pageType: p.page_type, description: p.description, sections, contentBrief };
  });

  const json = { project: project?.title || 'Website', exportedAt: new Date().toISOString(), pages: framerPages };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="framer-export.json"');
  res.json(json);
});

export default router;
import { Router, Response } from 'express';
import { getDb } from '../db.js';
import { UpdateBlocksSchema } from '../schemas/pages.js';
import { AuthenticatedRequest, Wireframe } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { exportRateLimit, exportCooldown, maxBlockLimit } from '../middleware/abuseProtection.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/pages/:pageId/wireframe
router.get('/:pageId/wireframe', (req: AuthenticatedRequest, res: Response): void => {
  const { pageId } = req.params;
  const db = getDb();

  const page = db.prepare(`
    SELECT p.id FROM pages p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ? AND pr.user_id = ?
  `).get(pageId, req.user!.userId);

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const wireframe = db.prepare('SELECT * FROM wireframes WHERE page_id = ?').get(pageId) as Wireframe | undefined;

  if (!wireframe) {
    res.status(404).json({ error: 'Wireframe not found' });
    return;
  }

  res.json({
    id: wireframe.id,
    page_id: wireframe.page_id,
    blocks: JSON.parse(wireframe.blocks),
    created_at: wireframe.created_at,
    updated_at: wireframe.updated_at,
  });
});

// PUT /api/pages/:pageId/wireframe
router.put('/:pageId/wireframe', maxBlockLimit, (req: AuthenticatedRequest, res: Response): void => {
  const { pageId } = req.params;
  const db = getDb();

  const page = db.prepare(`
    SELECT p.id FROM pages p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ? AND pr.user_id = ?
  `).get(pageId, req.user!.userId);

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const parsed = UpdateBlocksSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { blocks } = parsed.data;
  const blocksJson = JSON.stringify(blocks);

  db.prepare(
    'UPDATE wireframes SET blocks = ?, updated_at = CURRENT_TIMESTAMP WHERE page_id = ?'
  ).run(blocksJson, pageId);

  const wireframe = db.prepare('SELECT * FROM wireframes WHERE page_id = ?').get(pageId) as Wireframe;

  res.json({
    id: wireframe.id,
    page_id: wireframe.page_id,
    blocks: JSON.parse(wireframe.blocks),
    approval_status: (wireframe as any).approval_status || 'draft',
    created_at: wireframe.created_at,
    updated_at: wireframe.updated_at,
  });
});

// ── Comments ───────────────────────────────────────────────────

// GET /api/pages/:pageId/wireframe/comments
router.get('/:pageId/wireframe/comments', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const wireframe = db.prepare('SELECT id FROM wireframes WHERE page_id = ?').get(req.params.pageId) as any;
  if (!wireframe) { res.json({ comments: [] }); return; }

  const comments = db.prepare('SELECT * FROM wireframe_comments WHERE wireframe_id = ? ORDER BY created_at ASC').all(wireframe.id);
  res.json({ comments: comments || [] });
});

// POST /api/pages/:pageId/wireframe/comments/:blockId
router.post('/:pageId/wireframe/comments/:blockId', (req: AuthenticatedRequest, res: Response): void => {
  const { pageId, blockId } = req.params;
  const { text } = req.body;
  if (!text) { res.status(400).json({ error: 'Comment text required' }); return; }

  const db = getDb();
  const wireframe = db.prepare('SELECT id FROM wireframes WHERE page_id = ?').get(pageId) as any;
  if (!wireframe) { res.status(404).json({ error: 'Wireframe not found' }); return; }

  const id = crypto.randomUUID();
  const email = req.user!.email;
  db.prepare('INSERT INTO wireframe_comments (id, wireframe_id, block_id, user_email, text) VALUES (?, ?, ?, ?, ?)').run(id, wireframe.id, blockId, email, text);

  res.status(201).json({ id, wireframe_id: wireframe.id, block_id: blockId, user_email: email, text, created_at: new Date().toISOString() });
});

// ── Approval ───────────────────────────────────────────────────

// PUT /api/pages/:pageId/wireframe/approve
router.put('/:pageId/wireframe/approve', (req: AuthenticatedRequest, res: Response): void => {
  const { pageId } = req.params;
  const { status } = req.body;
  const validStatuses = ['draft', 'in_review', 'approved', 'changes_requested'];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }

  const db = getDb();
  db.prepare('UPDATE wireframes SET approval_status = ? WHERE page_id = ?').run(status, pageId);
  res.json({ approval_status: status });
});

// ── Interactive HTML Export ────────────────────────────────────

// POST /api/pages/:pageId/wireframe/export-html
router.post('/:pageId/wireframe/export-html', exportRateLimit, exportCooldown, (req: AuthenticatedRequest, res: Response): void => {
  const { pageId } = req.params;
  const db = getDb();

  const page = db.prepare(`
    SELECT p.*, pr.title as project_title, pr.branding_primary_color, pr.branding_secondary_color
    FROM pages p JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ? AND pr.user_id = ?
  `).get(pageId, req.user!.userId) as any;

  if (!page) { res.status(404).json({ error: 'Page not found' }); return; }

  // Get all pages for this project (for navigation)
  const allPages = db.prepare('SELECT id, title, slug, page_type FROM pages WHERE project_id = ? ORDER BY sort_order').all(page.project_id) as any[];

  const wireframe = db.prepare('SELECT * FROM wireframes WHERE page_id = ?').get(pageId) as Wireframe | undefined;
  const blocks: any[] = wireframe ? JSON.parse(wireframe.blocks) : [];

  // Check blueprint whitelabel
  const bp = db.prepare('SELECT * FROM blueprint_whitelabel WHERE user_id = ? AND enabled = 1').get(req.user!.userId) as any;
  const primaryColor = bp?.primary_color || page.branding_primary_color || '#1A9EF2';
  const secondaryColor = bp?.secondary_color || page.branding_secondary_color || '#4551D3';
  const generatorBrand = bp ? bp.company_name || 'Nuria Website Blueprint' : 'Nuria Website Blueprint';

  const navLinks = allPages.map((p: any) => `<a href="#page-${p.id}" class="nav-link">${p.title}</a>`).join('');

  const blocksHtml = blocks.map((b: any) => {
    switch (b.type) {
      case 'header': return `<header class="block header"><div class="logo">${b.title || 'Logo'}</div><nav>${navLinks}</nav></header>`;
      case 'hero': return `<section class="block hero"><h1>${b.title || 'Hero'}</h1><p>${b.subtitle || ''}</p><a href="#" class="cta-btn">${b.content || 'Get Started'}</a></section>`;
      case 'features': return `<section class="block features"><h2>${b.title || 'Features'}</h2><p class="sub">${b.subtitle || ''}</p><div class="feature-grid">${(b.content || '').split('|').map((f: string) => `<div class="feature-card"><h3>${f.trim()}</h3></div>`).join('')}</div></section>`;
      case 'content': return `<section class="block content-block"><h2>${b.title || 'Content'}</h2><p>${b.content || ''}</p></section>`;
      case 'cta': return `<section class="block cta-section"><h2>${b.title || 'Call to Action'}</h2><p>${b.subtitle || ''}</p><a href="#" class="cta-btn">${b.content || 'Click Here'}</a></section>`;
      case 'pricing': return `<section class="block pricing"><h2>${b.title || 'Pricing'}</h2><div class="pricing-grid">${(b.content || '').split('|').map((p: string) => `<div class="price-card"><h3>${p.trim()}</h3></div>`).join('')}</div></section>`;
      case 'testimonials': return `<section class="block testimonials"><h2>${b.title || 'Testimonials'}</h2><div class="testimonial-grid">${(b.content || '').split('|').map((t: string) => `<div class="testimonial-card"><p>"${t.trim()}"</p></div>`).join('')}</div></section>`;
      case 'faq': return `<section class="block faq-section"><h2>${b.title || 'FAQ'}</h2><div class="faq-list">${(b.content || '').split('|').map((q: string) => `<details><summary>${q.trim()}</summary><p>Answer placeholder</p></details>`).join('')}</div></section>`;
      case 'contact': return `<section class="block contact-form"><h2>${b.title || 'Contact'}</h2><form><input placeholder="Name"><input placeholder="Email"><textarea placeholder="Message"></textarea><button class="cta-btn">Send</button></form></section>`;
      case 'footer': return `<footer class="block footer"><p>${b.title || 'Footer'}</p><p class="copy">${b.content || '© 2026'}</p></footer>`;
      default: return `<section class="block generic"><h2>${b.title || b.type}</h2><p>${b.subtitle || ''}</p></section>`;
    }
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${page.title} — ${page.project_title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;background:#f8fafc;line-height:1.6}
.block{padding:40px 20px;max-width:1100px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:center;padding:16px 40px;background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:100}
.header .logo{font-weight:700;font-size:18px;color:${primaryColor}}
.header nav{display:flex;gap:20px}
.nav-link{color:#475569;text-decoration:none;font-size:14px;font-weight:500;transition:color .2s}
.nav-link:hover{color:${primaryColor}}
.hero{text-align:center;padding:80px 20px;background:linear-gradient(135deg,${primaryColor},${secondaryColor});color:white}
.hero h1{font-size:40px;margin-bottom:16px}
.hero p{font-size:18px;opacity:.9;margin-bottom:24px}
.cta-btn{display:inline-block;padding:12px 32px;background:white;color:${primaryColor};border-radius:8px;font-weight:600;text-decoration:none;transition:all .2s}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15)}
.features h2,.content-block h2,.pricing h2,.testimonials h2,.faq-section h2,.contact-form h2{font-size:28px;text-align:center;margin-bottom:8px}
.sub{text-align:center;color:#64748b;margin-bottom:32px}
.feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px}
.feature-card{background:white;padding:24px;border-radius:12px;border:1px solid #e2e8f0;transition:box-shadow .2s}
.feature-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08)}
.feature-card h3{font-size:16px;color:${primaryColor}}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
.price-card{background:white;padding:32px;border-radius:12px;border:2px solid #e2e8f0;text-align:center;transition:border-color .2s}
.price-card:hover{border-color:${primaryColor}}
.price-card h3{font-size:20px;color:${primaryColor}}
.testimonial-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}
.testimonial-card{background:white;padding:24px;border-radius:12px;border:1px solid #e2e8f0;font-style:italic}
.cta-section{text-align:center;background:${primaryColor};color:white;border-radius:16px;margin:20px auto}
.cta-section .cta-btn{background:white;color:${primaryColor}}
.cta-section p{opacity:.9;margin-bottom:20px}
.faq-list details{background:white;padding:16px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;cursor:pointer}
.faq-list summary{font-weight:600;color:${primaryColor}}
.contact-form form{display:flex;flex-direction:column;gap:12px;max-width:500px;margin:0 auto}
.contact-form input,.contact-form textarea{padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px}
.contact-form button{border:none;cursor:pointer}
.footer{text-align:center;padding:32px;border-top:1px solid #e2e8f0;color:#94a3b8;margin-top:40px}
.copy{margin-top:8px;font-size:12px}
.generic{padding:40px 20px}
@media(max-width:768px){.header{flex-direction:column;gap:12px}.header nav{flex-wrap:wrap;justify-content:center}}
</style></head>
<body>
${blocksHtml}
<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">
  Generated by ${generatorBrand} — ${page.project_title}
</div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="${page.title.replace(/\s+/g,'-')}-prototype.html"`);
  res.send(html);
});

export default router;
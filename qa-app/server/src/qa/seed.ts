import { getDb } from '../db.js';
import { CATALOG } from './catalog.js';

/**
 * Upsert the checklist catalog into the existing `checklist_categories` and
 * `checklist_items` tables. Ids are stable slugs, so re-running this updates the
 * wording/severity of existing items without touching anyone's answers.
 */
export function seedChecklist(): void {
  const db = getDb();

  CATALOG.forEach((category, categoryIndex) => {
    const existingCategory = db
      .prepare('SELECT id FROM checklist_categories WHERE id = ?')
      .get(category.id);

    if (existingCategory) {
      db.prepare(
        'UPDATE checklist_categories SET name = ?, description = ?, "order" = ?, active = 1 WHERE id = ?',
      ).run(category.name, category.description, categoryIndex, category.id);
    } else {
      db.prepare(
        'INSERT INTO checklist_categories (id, name, description, "order", active) VALUES (?, ?, ?, ?, 1)',
      ).run(category.id, category.name, category.description, categoryIndex);
    }

    category.items.forEach((item, itemIndex) => {
      const siteTypes = item.applicableSiteTypes?.length ? item.applicableSiteTypes.join(',') : null;
      const existingItem = db.prepare('SELECT id FROM checklist_items WHERE id = ?').get(item.id);

      if (existingItem) {
        db.prepare(
          `UPDATE checklist_items SET
             category_id = ?, title = ?, description = ?, severity = ?, remediation_guidance = ?,
             applicable_site_types = ?, "order" = ?, active = 1
           WHERE id = ?`,
        ).run(
          category.id,
          item.title,
          item.description,
          item.severity,
          item.remediation,
          siteTypes,
          itemIndex,
          item.id,
        );
      } else {
        db.prepare(
          `INSERT INTO checklist_items
             (id, category_id, title, description, severity, remediation_guidance,
              applicable_platforms, applicable_site_types, "order", active, version)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, '1.0')`,
        ).run(
          item.id,
          category.id,
          item.title,
          item.description,
          item.severity,
          item.remediation,
          siteTypes,
          itemIndex,
        );
      }
    });
  });
}

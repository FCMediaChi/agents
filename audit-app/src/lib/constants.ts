export const APP_NAME = 'Nuria Website Audit';

export const AUDIT_REPORT_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type AuditReportStatus = (typeof AUDIT_REPORT_STATUSES)[number];

export const AUDIT_REPORT_STATUS_LABELS: Record<AuditReportStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

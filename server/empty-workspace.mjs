import F from '../dist/finance-core.js';

// Configuration templates are retained; no demo business record is introduced.
export function emptyWorkspace(ownerId, at = new Date().toISOString()) {
  const date = F.dateOf(at, 'Asia/Jakarta');
  return {
    ownerId,
    operations: {
      version: 1,
      settings: { date, company: 'Top Hills & Co', hoursOpen: '08:00', hoursClose: '18:00',
        responseMinutes: 10, closingMinutes: 30, float: 0, maxCash: 0, depositTime: '10:00',
        labelNext: 1, labelEnd: 999, receiptNext: 1, receiptEnd: 999, packages: [], checklist: {}, configured: false },
      employees: [], tenants: [], orders: [], invoices: [], reports: [], evaluations: [], settlements: [], audit: [], requests: []
    },
    finance: { policies: F.clone(F.defaultPolicies), transactions: [], journals: [], attachments: [], bankRows: [],
      periods: [], snapshots: [], budgets: [], insights: [], audit: [], lastAutoDate: date, startedOn: date },
    projectionsReady: true
  };
}

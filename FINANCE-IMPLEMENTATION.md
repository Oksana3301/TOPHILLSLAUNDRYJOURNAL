# Top Hills · Menu Laporan

This update extends the existing private Site and preserves its laundry, tenant, collection, team and SOP interfaces. All business fixtures, amounts, vendors and customers are fictional. No payment processing or external messaging is connected.

## Implemented workflow

- Persistent operational state and double-entry journal in D1, private receipt/document bytes in R2. Files are never stored in browser storage. Browser storage retains only view/filter preferences and the previous local demo archive.
- Platform-authenticated identity with server roles Owner, Finance, Operator, Consumer. The first visitor initializes the Owner only because the existing Site audience was verified to contain its sole Owner. Later authenticated visitors remain pending until that Owner assigns a role. The update does not widen Site access.
- P&L on accrual basis; cumulative Balance Sheet as of period end; direct Cash Flow with operating/investing/financing categories. Opening balances, internal transfers, QRIS receivables, deposits and collection of AR do not inflate revenue.
- Daily/monthly/custom periods, customers and business units; previous-period comparison; monthly budgets; saved view filters; dated operational lists. Customer/source-scoped outputs carry an analytical label.
- Expense, credit invoice, vendor payment, inventory use, asset purchase, depreciation, prepaid allocation, capital, loans, drawings, refund, credit note, reversal and shared-cost reallocation. Per-unit journals balance; interunit assets/liabilities eliminate at entity level.
- Partial payments and multiple invoice allocations. Cash receipts receive a sequential number; closing totals their payment amounts across units, not the final status or full value of an order. Cash intake cannot pay business expenses.
- Completion/payment/invoice/settlement events generate uniquely keyed financial candidates. Missing data holds posting. Automatic candidates require actual evidence and review; scan can safely be repeated. Fixtures are explicitly excluded from repeat ingestion.
- Draft → submitted/held → posted, with independent account review before Final. The preparer cannot be the only final reviewer. Reversal preserves the old journal and requires a reason.
- CSV bank import with preview, validation and duplicate detection; independent manual matching; period Open/Review/Closed and reasoned reopening; immutable snapshot copies, superseded after a relevant journal change.
- PDF, actual XLSX, CSV detail exports; current and archived report packages; account→journal→transaction→private-proof drilldown.
- SHA-256, original file bytes, numbered proof versions, document metadata and audit record. PDF/JPEG/PNG only, 10 MB/file, 10 files/transaction. Replacement is another version.
- Source-backed detection D01–D16, follow-up owner/PIC/status/reason. Duplicates and anomalies are indications to inspect, never fraud accusations.
- Non-destructive preview/import of previously saved operational JSON by ID. Existing local data is retained in the original browser archive and is not silently counted as new income. Legacy paid totals with missing payment history remain exceptions.

## Verification

`npm test` covers existing operational/access behavior, accounting fixtures, split and deferred payments, cashflow categories, shared costs, rejected duplicates, date boundaries, file persistence and versions, object authorization, immutable posted sources, concurrency, idempotent retries, customer scoping, closure prerequisites, template wiring and generated XLSX/PDF. Server tests run the built Worker against SQLite with D1-compatible batch rollback and an R2 test adapter. These are functional tests, not browser visual QA or production load claims.

Fixture expected amounts (rupiah): 10 Sep net profit 50,000, cash 4,500,000; 11 Sep profit 70,000, cash 5,000,000. Combined profit 120,000, cash movement -500,000, assets 13,020,000, liabilities 2,500,000, equity 10,520,000; both statement tie-out differences zero.

## Remaining acceptance limits

- The available hosting contract does not expose cron configuration. A scheduled Worker handler with idempotent draft catch-up is implemented and tested, but a platform timer is not active. The live app transparently generates drafts on Owner/Finance access. GEN03/U19 cannot be claimed operational with the browser closed until a supported timer is connected.
- This release is a fictional-data working prototype. The proposed 100,000-transaction/5-second performance target is not certified: workspace revision state is currently serialized in D1, alongside relational ledger projections. Large-data streaming, paginated server-side aggregation and a queued export system need a separate scale implementation before that target can be promised.
- Malware scanning beyond file signatures is not available through the current platform tools. PDF responses are sandboxed, links are authenticated and no public proof link is produced. Automated retention/purge and disaster-recovery restoration of uploaded binary archives are not connected.
- Full backup downloads include operations, journals and attachment metadata; original proof files can be individually downloaded. Restore/import currently merges the legacy operational format, not a full database or R2 disaster-recovery archive.
- Scheduled depreciation, prepaid allocation, detailed quantity-based stock counts, fiscal-year closing, custom account versioning and automated alert SLA notifications require additional configuration/implementation. Their current journal entry routes support reviewed manual recording. Currency is IDR; separate legal entities require separate workspaces.
- Private audience currently contains the Owner only. Independent financial review requires another authorized account and a deliberate Site-access change by the Owner; this update grants no external access. Historical fictional fixtures are labeled assumptions and do not constitute real approval or audit evidence.

## Build and storage

Source retains the existing static asset folder. `scripts/build-finance.mjs` bundles a Workers-compatible server, embeds only public asset files, and stages the logical D1/R2 manifest and generated Drizzle migrations. Schema changes live in `db/schema.ts`; applied migrations are immutable. Structured mutations use revision CAS in the same D1 transaction as journal projections and audit. Uploaded bytes are deleted if attachment metadata fails to commit. Reuse the same mutation ID after an unknown network result; a different payload with that ID is rejected.

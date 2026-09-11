> Update 11 September 2026: lihat [audit terbaru](SOP-V04-RELEASE-AUDIT.md) dan /sop-coverage. Site sekarang public; data operasional memerlukan login staf. Adapter login email tersedia tetapi belum diaktifkan. Catatan berikut menyimpan konteks implementasi awal.

# Top Hills customer QR portal — SOP v0.4 implementation

Source: SOP_Operasional_Laundry_Top_Hills_v0.4_Draft (3).docx, supplied September 11, 2026. The shared conversation URL was not accessible. This implementation uses the supplied Word document.

## Access and operating paths

- Existing dashboard: `/`, adds Meja laundry & QR on desktop and mobile menu.
- Customer: `/checkin#room=<opaque capability>`. Owner generates/rotates a QR inside Meja laundry → Kamar & QR. No public room selector. Hash fragment avoids putting secrets in ordinary HTTP request URLs or referrers. The token is sent as an Authorization bearer only to same-origin endpoints. It necessarily exists inside the QR and is readable by anyone possessing that QR; it is not a password protecting an entire room's history.
- Customer tracking: `/checkin#order=<THL>&key=<separate capability>`. One secret per order, stored hashed in D1. Can be used on another device; does not expose other orders. Rotating a room QR does not invalidate existing order links.
- Staff: `/laundry-desk`, uses trusted platform identity headers and existing active member role. Staff first sign in with ChatGPT through the existing dashboard. Unknown accounts remain pending until Owner approval. No custom password database or fake email registration.
- Demo: `/sop-demo.html`, 12 interactive fictional scenarios running the shared state engine in memory. Reload resets simulation; no fetch/database writes from demo.
- Site's outer access remains Owner-only until explicit audience change. A customer-facing application route alone cannot bypass the platform access policy.

## Persisted implementation

Additive migration `0001_moaning_jigsaw.sql`: room master, per-order rows, atomic date/room sequences, immutable events, private R2 proof metadata, and idempotency records. Existing accounts and business data are preserved. 117 room master records are initialized by the Owner screen, never invented occupants. Floor, room type and checkout must be configured from actual room data before QR activation. Room records are separate from legacy tenant records; automatic occupancy synchronization has not been implemented.

Room tokens: random 256-bit, SHA-256 storage, rotation, active-room checks and fixed-room submission. Submission token retained for retry until success; unique key prevents duplicate orders. Order changes use optimistic revision checks and transactional event/idempotency writes. First acceptance retains actual actor/name/time; later revision acceptance is distinct. R1 and customer revisions remain available as historical snapshots. Public input cannot overwrite room, source, payment, settlement or staff actor.

Intake: assisted THL with pending identity or unidentified INT; live-camera capture path, bag count, storage location, label, arrival/recorded times; >5-minute alert. Owner links verified INT to a new THL once; original INT retained and custody transferred, not double-counted. Re-label required. Browser camera metadata records capture method; it is not forensic proof against a malicious client or physical fraud.

Order stages: submitted, awaiting pickup/dropoff, custody, weighing/price confirmation, process/batch scan, ready/QC, handover/completed; pending revisions block affected actions. Customer can revise, confirm/reject ownership, approve price and request cancellation. Paid cancellation preserves PAY and creates REF. Return and handover require evidence; unpaid handover needs Owner override. Operator cannot clear source, set identity without evidence, or delete history.

Money: Cash and Transfer attempts, evidence pending verification, independent bank verifier, partial and excess amounts, cash receipt number, SET in transit, independent SET review, short/over exception, approved partial/full refund. QRIS provider is not configured and cannot be marked paid through a fake webhook. SET review excludes all recorded payment receivers and the settlement submitter. Clear requires completed/paid/matched/no refund or open exception. Generic evidence-backed incidents record other operational disputes and after-payment corrections for Owner handling.

Notifications are queued pending a provider. Retry does not pretend sent, delivered or read. Alerts currently calculated on access: missing intake, identity overdue, unacknowledged revision, unaccepted order, open INT, checkout approaching, late settlement, and explicit incidents. Shift review compares entered physical bags and cash against server-derived custody totals (linked INT excluded), preserves reports and independent Owner review, and leaves differences open. Desk refreshes every 15 seconds when no dialog/camera is active. No claimed WebSocket, scheduled WhatsApp job or machine sensor integration.

## Accounting integration and limits

Owner/Finance opening the existing dashboard, or selecting Detect sources in Laporan, imports unique unposted financial proposals for portal service completion, recorded payment attempts and matched cash deposits. Proofs reference the original private R2 object. These are reviewable proposals, not automatic final statements. Existing posting, period, bank matching and accounting gates remain in force. Portal orders are not copied into the old operations JSON.

The legacy finance/operations workspace still uses a large JSON row; this update does not migrate that old store or implement full backup/restore. Portal-specific order storage avoids that bottleneck for new QR orders but finance growth retains the prior limit. Fee accounting, refund journal synchronization, supplemental PAY after paid price changes, provider payout batches and automated machine-cycle reconciliation still require development/review before declaring every SOP condition production-complete. These conditions can be recorded as incidents now; they are not falsely auto-reconciled. Cash settlement with fees requires manual fee accounting; unmatched cash/finance gates continue to prevent inappropriate formal finalization.

## Validation

- 27 engine tests: role/status gates, revision, intake, label, price/attempt expiry, screenshots, cash/settlement, refund, handover, checkout, partial payment.
- 20 API tests against real SQLite schema with D1-compatible transaction adapter and test object storage: idempotency, concurrent accept, room tampering/rotation, per-order isolation, actor permissions, upload bytes, INT link, denied audit, custom range, finance proposal detection.
- 12 complete interactive demo scenarios verified using the bundled engine in a DOM stub. This is not browser visual QA.
- Existing regression suite: 65 Node tests; 16 finance UI checks; 13 core workflow checks; 7 account/motion checks.
- No connected QRIS webhook/payment settlement integration or WhatsApp delivery test. No real money or customer data used. Real mobile camera permissions, printing/scanning room QR, SIWC cross-device login and final layout need a pilot on actual devices. The existing custom Worker build has no compatible supervised browser development server, so browser visual QA was unavailable.

## Before customer launch

1. Explicitly approve public customer access at Site level, with staff and data API restrictions retained.
2. Owner verifies floor/type/checkout and activates room QR; print/test correct room matching on actual phones.
3. Approve individual staff accounts and independent Finance/Owner reviewer; no shared login.
4. Trial real camera and device/network loss, restore/backup, and review limits above.
5. Connect an authorized payment provider and WhatsApp business provider before describing those channels as operational.

Do not describe this as complete production implementation of every v0.4 exception. It is a persisted pilot with tested core flows and explicit remaining integrations/work.

# Inventory Intelligence

Thai inventory dashboard for Google Apps Script + Google Sheets. This product is a source-code template installed separately in each buyer's Google account. The supported deployment is **owner-only** (`MYSELF`), executing as the deploying user.

## Install

Open [the Thai installation guide](docs/installation.html). Create a new Google Sheet → Extensions → Apps Script. Paste `Code.js` into `Code.gs`, create HTML file `Index` from `Index.html`, and copy the manifest. Run `setupEmpty`, authorize, then deploy as a Web app with access **Only myself**. Use the `/exec` URL.

Opening `Index.html` directly runs a disposable, in-memory demo; refreshing clears demo changes. Real data is stored only in the installed Google Sheets backend.

## Develop and verify

```sh
npm ci
npm test
npm run dev
npx playwright test
npm run build
```

The preview is at http://127.0.0.1:4173. The build creates a buyer package in `dist/`, without the seller's `.clasp.json`, credentials, CI files or dependencies. `Code.gs` in the package is copied from `Code.js`.

## Installation video

```sh
npm --prefix video ci
npm run video
npm run video:render
```

Remotion Studio shows a Thai 16:9 motion-graphics installation guide. Its source is in `video/src`. MP4 output is `out/installation-guide.mp4`; it is a captioned guide without narration.

## Updates and data safety

Back up the Google Sheet before an update. Replace source files, then update the existing deployment to a new version; keep the existing deployment ID and URL. Roll back by choosing the previous Apps Script version. Never overwrite production data with a sample dataset or edit stock cells directly. Use stock adjustment transactions.

Validation prevents negative stock, nonfinite numbers, duplicate purchase lines, repeated PO receipts and deletion of products with audit history. Sample setup refuses a nonempty database. Text written to Sheets and exported CSV is escaped against formula execution. Script locks serialize stock writes. Apps Script/Sheets do not provide database transactions: a Google service failure during a multi-step write may require reconciliation from transaction history and the backup.

## Product scope

Includes product CRUD, stock receipt/issue/adjustment, weighted average inbound cost, dashboard, ABC analysis, reorder planning, PO receipt, CSV exports, email alerts and monthly report triggers. One owner per installation. No multi-tenant authentication, user roles, multiple warehouses, lot tracking, CSV import, payment system or accounting certification. Aging is time since last receipt; historical stock valuation uses current product costs and should be treated as an estimate. Historical analytics require sufficient `lookbackDays` (365–3650).

Google Apps Script, Sheets and MailApp quotas apply. External Chart.js and Google Fonts require internet access. Buyer data stays in the buyer's Google account; the seller does not automatically receive it.

See [release verification](docs/release-checklist.md) and [deployment](docs/deployment.md). Commercial distribution must use the seller's approved license and support/refund terms; no price is imposed by this repository.

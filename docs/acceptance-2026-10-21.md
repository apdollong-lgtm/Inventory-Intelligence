# Live acceptance — 21 October 2026

The owner authorized a separate Google Apps Script QA project. No production stock was changed. Run token: `INV-QA-20261021-221101`.

## Google execution evidence

Twelve checks passed in the real Apps Script runtime: effective owner, Asia/Bangkok timezone, opening stock, receipt/issue reconciliation, oversell rejection, PO receipt, duplicate receipt rejection, ledger reconciliation, Google Sheets backup with matching stock/history, manual alert send, monthly report generation and repeatable installation of exactly two application triggers.

Manual alert email and monthly-report email were found in the owner's Gmail Inbox. The alert message contains both plain-text and escaped HTML alternatives. The report email links to the generated report sheet and reports the expected test stock value of THB 140.

Google executed the one-off time-driven acceptance handler at **22:12:49 Bangkok time**, finishing successfully at **22:12:59**. It invoked the real stock-alert and monthly-report functions. All QA triggers were removed and QA email alerts were disabled after this execution. These are execution observations; the future daily/monthly schedule itself has not been waited out for a calendar day/month.

## Commerce evidence and limits

- A real source ZIP was downloaded from the authenticated catalog and passed ZIP integrity inspection. Installation source, manifest, guide and license files were present.
- An anonymous request to the same asset endpoint returned HTTP 401.
- Anonymous checkout redirected to login while preserving the Inventory checkout destination.
- Public launch status reports counsel review recorded, payments on, and accepting money open. These existing settings were inspected, not changed.
- Catalog tests cover server-owned THB 999 pricing, missing purchase-terms rejection, a Stripe SDK-generated test signature, mismatched order/payment rejection, permanent access issuance and replay handling, and download denial before entitlement.

**Still required:** a non-admin buyer checkout in a configured Stripe test environment or an owner-performed real purchase, followed by verification of webhook delivery, order/payment state, permanent entitlement, first/repeat download and no download credits charged. Admin access does not prove this path. No real payment or production entitlement has been fabricated.

Status remains Beta until that final commerce acceptance is completed. Screenshots and private Google identifiers are retained locally under ignored QA/output folders, not included in the buyer package.

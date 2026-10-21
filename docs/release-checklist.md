# Release verification

Automated checks cover stock reconciliation, weighted cost, input validation, PO validation and duplicate receipt, audit protection, sample data safety, settings and spreadsheet/CSV formula escaping. Browser checks cover all pages, product creation, transaction update, error handling and mobile navigation.

Before describing a release as production ready, perform these checks on a separate owner-controlled Google Sheet (never the live inventory):

- Install using the buyer package without the seller's script ID.
- Authorize `setupEmpty`, deploy with Only myself, open `/exec` and reload to confirm persistent data.
- Add a product, receive, issue, adjust, create/receive PO; compare stock and transaction sums in Sheets.
- Verify a second PO receipt is rejected and no stock changes.
- Save alert email; verify delivery and quota behavior using a test recipient controlled by the owner.
- Generate a monthly report and verify the new sheet.
- Install triggers and inspect time zone and trigger list.
- Verify backup and version rollback.
- Approve commercial license, price, support contact and refund terms in the catalog.
- Verify authorized purchase, entitlement and package download through the catalog checkout.

Local automated tests do not prove Google OAuth, email delivery, trigger execution or buyer checkout. Record these separately. Do not mark unchecked items as passed.

# Deployment and catalog updates

`master`/`main` push → tests → buyer package → video render → GitHub OIDC → catalog metadata + private source ZIP + installation video. Failures stop publishing. Runs serialize so an older upload cannot overwrite a newer one. Version comes from `catalog-product.json`; bump it with `package.json` when releasing changes.

The catalog integration authenticates this repository to its own slug only. It creates a visible Beta listing at the owner's approved price of THB 999, using the existing FactoryStudio license and support terms. Subsequent price, sales, publication and license/support changes remain in the catalog Admin. Metadata updates do not change commerce settings. Beta status remains until Google live acceptance checks are recorded.

Catalog source lives in `apdollong-lgtm/factorystudio-code-catalog`. Its release route must contain the Inventory mapping before the workflow can publish. Vercel deploys that catalog repository; this product repository updates the listing through the existing release API.

After the catalog integration PR has been approved, merged and deployed, set the Inventory repository variable `CATALOG_SYNC_ENABLED=true`. Until then the workflow produces tested delivery artifacts and skips catalog upload. This prevents a failed publication attempt while the production integration is awaiting approval.

The catalog workflow updates downloadable product files, not a buyer's installed Apps Script or Google Sheet. Buyers update their own deployments using the installation guide. The seller's existing Apps Script deployment can be updated with clasp; its credentials must never be committed or packaged.

The manifest intentionally permits only the deploying owner. The catalog is the sales/download surface, not a publicly accessible inventory database.

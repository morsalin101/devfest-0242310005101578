# TenderDesk

A professional React + Vite + TypeScript dashboard that checks and combines tender documents entirely in the browser. All interface icons are SVG. Supports English and Bangla.

**Participant:** Md.Morsalin

**Registration:** 0242310005101578

**Repository:** https://github.com/morsalin101/devfest-0242310005101578

**Public HTTPS live URL:** [TenderDesk](https://devfest-0242310005101578-src-gray.vercel.app/).

This is a practice implementation, not a claim of contest-time eligibility. Deployed by the participant on Vercel.

## Run and build

Use Node.js **22.22+ on the 22.x line, 24.x, or 26+**, and npm. Verified locally with Node 26.7.0 and Chrome.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

The production build is in `dist/`. No backend, database, environment variables or serverless functions are required. The build also copies PDF.js font maps and decoders into `dist/pdfjs/`. The Bengali font is bundled locally under `public/fonts/`.

On Windows, Node must be on your terminal's PATH. Reopen the terminal after installing Node if `node` or `npm` is not recognized.

## Prepare a package

1. Import a `requirements.json` file, or click **Load sample pack**.
2. Open **Documents** and upload your PDFs together. The app accepts up to **30 files / 50 MiB total** and lists page counts. Remove unwanted files with the SVG trash control.
3. Select a PDF for each requirement. A file and identical content can serve only one requirement. Duplicate uploaded files remain visible and flagged.
4. Enter expiry dates where requested. The app compares them against the tender's submission deadline; expiry on the deadline is valid.
5. Resolve every **Missing**, **Expiry date needed**, and **Expired** status. **Not provided** applies to unmatched optional requirements and does not block generation.
6. Click **Generate package**, review the PDF and download `<tender_id>_Package.pdf`. Any change to the checklist, language, index or image placements requires regeneration before downloading.

The cover stays in English and includes all required tender fields, the date in Asia/Dhaka, and included documents in order. Source pages retain their page order and rotation. A new footer band is added below the source content; every page includes the tender ID and `Page X of Y`.

## Main features completed

- Validated requirements import with unique IDs/orders and calendar dates.
- Multi-file PDF intake, previews, page counts, rejection messages and removal.
- Reversible one-to-one matching and SHA-256 duplicate detection/enforcement.
- All five prescribed statuses with immediate updates and visible generation blockers.
- English cover, ordered documents, safe footers and named PDF download.
- Complete English/Bangla interface and remembered language preference.

## Bonus features completed

- Optional document index, enabled by default, with calculated start pages.
- Properly shaped Bangla index titles using the locally bundled Bengali font and browser canvas; non-Western cover field values use the same fallback.
- PNG seal/signature placement on chosen package pages by clicking the preview or using the keyboard-accessible placement button. Image size is adjustable; image placements cannot enter the footer band.
- UTF-8 CSV checklist export with a BOM for Excel, quoted cells and formula-prefix escaping.
- Versioned project export/import including the PDF bytes, assignments, expiry dates, language, index and PNG placements. Imported PDFs are parsed and hashed again before the current project changes.
- Confirmable filename suggestions that avoid ambiguous trade-license versions and repeated duplicate content.
- Clear handling of non-PDF, damaged and encrypted uploads.
- Optional Gemini matching suggestions with the user's own key, held only in component memory. Only requirement IDs/titles and file IDs/names are sent after clicking the AI button. PDF bytes, dates and company details are excluded. The main workflow works without AI. The model field is editable; default: `gemini-2.5-flash`.

## Checked sample and artifacts

Load the sample, open **Project tools**, and choose **Use checked sample matches**. This helper verifies the original requirements and expected sample file hashes. It uses the 2026 trade license (expiry `2027-06-30`), the bank certificate (expiry `2026-12-31`), one experience certificate, and `scan_0042.pdf` as the signed declaration. The older license and duplicate stay unmatched. The two absent optional documents are skipped.

- [`output/T-2026-0417_Package.pdf`](output/T-2026-0417_Package.pdf): **17 pages** with the default English index, no added seal. Turning the index off produces **16 pages**.
- [`screenshots/`](screenshots/): separate Overview and Documents screens in English and Bangla, package preview, Bangla PDF index and mobile layouts.
- [`docs/AI_PROMPTS.md`](docs/AI_PROMPTS.md): original prompt and feature-stage instructions.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

The 42 unit tests cover validation, expiry boundaries, duplicate assignments, PDF errors, size limits, PDF order/rotation, project round-trip, CSV, suggestions, PNG/index generation and optional AI behavior. The production Chrome checks exercise the UI, verify every sample footer and original document text/page sequence, and capture the output/screenshot artifacts. They also check route separation, issue links, keyboard focus, browser back/forward, shared project state and direct route reloads. AI requests are intercepted with success/failure responses during verification; no real API key is used. Real AI availability depends on your key, model, quota and network.

`npm run test:e2e` requires installed Google Chrome. It starts a temporary Vite preview at `127.0.0.1:4173`, then stops it. Set `VERIFY_BASE_URL` only when using your own existing preview server. Temporary downloads are ignored under `.test-results/`.

## Vercel deployment

1. Import this GitHub repository into your Vercel account.
2. Select the **Vite** framework preset and the repository root.
3. Set the build command to `npm run build` and output directory to `dist`. The repository also sets these values and the Vite framework in `vercel.json`, overriding a stale `build` output directory in Project Settings.
4. Deploy the final commit without adding a backend or API-key environment variable.
5. Keep the public HTTPS live URL above updated if the deployment address changes.

The dashboard uses separate `/overview`, `/documents`, `/package`, and `/tools` routes. Overview shows the tender summary and readiness; Documents contains uploads, matching, expiry dates and previews. Project state is shared across navigation. The included `vercel.json` rewrites direct route requests to `index.html`, so refreshing or opening a bookmarked page works on Vercel. A full reload still requires reopening an exported project to restore files. Deployment is managed by the participant. See [Vite's static deployment guide](https://vite.dev/guide/static-deploy.html).

## Known limitations

- Encrypted PDFs must be unlocked before upload; no OCR or signature authenticity checking is performed.
- Filename and AI suggestions do not read the documents or infer expiry dates. Review matches and enter dates yourself. Only the original fictional sample helper supplies verified sample dates.
- Work is not automatically saved. Export a project before reloading or closing the browser; only the language preference persists automatically.
- Bangla PDF text fallback is rendered as images, so those labels are not selectable/searchable. The PDF cover's main labels remain English.
- Source PDFs are embedded as page content; interactive form/annotation behavior is not retained. Flatten such content before upload if its appearance depends on annotations.
- Extremely long cover values or document names can exceed the required single cover page. Generation reports an error instead of clipping the cover.

## AI tools and prompt history

AI tool used: **OpenAI Codex** for implementation and verification. Gemini is an optional user-facing feature, not required to create the package.

Most useful prompt: **“PLEASE IMPLEMENT THIS PLAN: React/Vite Tender Package Dashboard”**, followed by the accepted feature, PDF and verification requirements. The original user prompt is recorded verbatim in the first feature commit and in `docs/AI_PROMPTS.md`.

Three feature commits were produced by the coding agent. An additional already-pushed `Create bonus.ts` commit appeared during implementation and was preserved, so there are four new commits after the initial commit. No pushed history was rewritten.

## License

Application code: [MIT](LICENSE). Bengali font: [SIL Open Font License](public/fonts/OFL.txt). PDF.js: Apache-2.0; React, Vite and pdf-lib: MIT. See [third-party notices](docs/THIRD_PARTY_NOTICES.md). Supplied PDFs and samples are fictional organizer materials included for contest/practice use.

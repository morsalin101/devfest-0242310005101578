# Verification record

Verified locally on 6 October 2026 using Node.js 26.7.0 and installed Google Chrome.

- `npm run build`: passed TypeScript and Vite production build.
- `npm test`: all **42 tests** passed across two suites.
- `npm run test:e2e`: all Chrome production workflow checks passed.
- Dependency install audit: **0 reported vulnerabilities**.
- `git diff --check`: clean after documentation whitespace cleanup.

## Browser scenarios

Requirement import, invalid JSON isolation, sample intake, all five statuses, non-PDF/damaged/encrypted rejection, preview rendering, confirmed suggestions, sample resolution, match undo/replacement, content-identical duplicate blocking, expiry before/on/after deadline, CSV export, project round-trip, invalid project isolation, 30-file limit, oversized rejection and file removal.

The index toggle disables stale downloads. PNG images are placed on chosen preview pages and embedded in the result. AI success/failure requests are mocked and checked to contain only requirement titles and filenames/IDs; API keys are excluded from saved projects. No live key was provided, so real Gemini access was not tested.

English and Bangla interfaces, Bangla PDF index image resources, English cover, remembered language, keyboard navigation, 390px mobile layout and 200% text enlargement were checked. Screenshots were inspected after waiting for PDF rendering to finish.

## Checked PDF artifact

`output/T-2026-0417_Package.pdf` has **17 pages**, including an English cover and English index. No extra seal was applied to this submission artifact.

| Document | First page | Pages |
| --- | ---: | ---: |
| Trade License (2026) | 3 | 1 |
| TIN Certificate | 4 | 1 |
| VAT Registration Certificate | 5 | 1 |
| Bank Solvency Certificate | 6 | 1 |
| Experience Certificate | 7 | 2 |
| Technical Proposal | 9 | 6 |
| Financial Proposal | 15 | 2 |
| Signed Declaration (`scan_0042.pdf`) | 17 | 1 |

Every page's tender ID and `Page X of 17` footer was checked. The English source text and page sequence were compared against each included sample PDF. Separate tests check preserved source dimensions/rotation and the additional footer band. Turning off the index produces **16 pages**.

Generated screenshots: `statuses-english.png`, `statuses-bangla.png`, `package-preview.png`, `index-bangla.png`, and `mobile-dashboard.png`.

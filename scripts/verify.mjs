import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:4173";
const server = process.env.VERIFY_BASE_URL
  ? undefined
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4173",
        "--strictPort",
      ],
      { stdio: "pipe", windowsHide: true },
    );
let browser;
const failures = [];
const report = (message) => console.log(`PASS: ${message}`);
const asset = (name) => `public/sample-pack/documents/${name}`;
async function saveDownload(page, label, destination) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  const file = await pending;
  if (destination) await file.saveAs(destination);
  return {
    bytes: await readFile(await file.path()),
    name: file.suggestedFilename(),
  };
}
async function textPages(bytes) {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      pages.push(
        text.items
          .map((item) => item.str || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
async function loadSample(page) {
  await page
    .getByRole("button", { name: "Load sample pack", exact: true })
    .click();
  await page
    .getByText("Sample pack loaded. Match the files and enter expiry dates.", {
      exact: true,
    })
    .waitFor();
}
try {
  await mkdir("output", { recursive: true });
  await mkdir("screenshots", { recursive: true });
  await mkdir(".test-results", { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (attempt === 100) throw Error("Preview server did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(base);
  await expect(
    page.getByRole("button", { name: "Generate package", exact: true }),
  ).toBeDisabled();
  await page
    .locator('input[aria-label="Import requirements"]')
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Invalid requirements JSON",
  );
  await loadSample(page);
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expect(page.locator(".file-item")).toHaveCount(10);
  await expect(page.locator(".status.missing")).toHaveCount(8);
  await expect(page.locator(".status.notProvided")).toHaveCount(2);
  await page.waitForFunction(
    () =>
      document.querySelector("canvas")?.dataset.renderedPage === "1" &&
      !document.querySelector(".rendering"),
  );
  report(
    "sample intake, missing/optional statuses, invalid requirements and rendered PDF preview",
  );

  const input = page.locator('input[aria-label="Upload PDFs"]');
  await input.setInputFiles(asset("company_logo.png"));
  await expect(page.getByRole("alert")).toContainText("Only PDF");
  await input.setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\ncorrupt"),
  });
  await expect(page.getByRole("alert")).toContainText("damaged");
  const locked = await PDFDocument.load(
    await readFile(asset("experience_cert.pdf")),
  );
  locked.context.trailerInfo.Encrypt = locked.context.register(
    locked.context.obj({ Filter: "Standard", V: 1, R: 2, Length: 40 }),
  );
  await input.setInputFiles({
    name: "locked.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await locked.save({ useObjectStreams: false })),
  });
  await expect(page.getByRole("alert")).toContainText("Password-protected");
  await expect(page.locator(".file-item")).toHaveCount(10);
  report(
    "non-PDF, damaged and encrypted file errors without modifying accepted files",
  );

  await page
    .getByRole("button", { name: "Suggest matches", exact: true })
    .click();
  await expect(page.locator(".suggestion")).toHaveCount(6);
  await page
    .locator(".suggestion")
    .first()
    .getByRole("button", { name: "Confirm match" })
    .click();
  await expect(page.locator('[data-requirement="R02"] .status')).toHaveText(
    "OK",
  );
  await page
    .getByRole("button", { name: "Project tools", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use checked sample matches", exact: true })
    .click();
  await expect(page.locator(".status.ok")).toHaveCount(8);
  await expect(page.locator(".status.notProvided")).toHaveCount(2);
  const tradeDate = page.locator('[data-requirement="R01"] input');
  await tradeDate.fill("2026-10-19");
  await expect(page.locator('[data-requirement="R01"] .status')).toHaveText(
    "Expired",
  );
  await expect(
    page.getByRole("button", { name: "Generate package", exact: true }),
  ).toBeDisabled();
  await tradeDate.fill("2026-10-20");
  await expect(page.locator('[data-requirement="R01"] .status')).toHaveText(
    "OK",
  );
  await tradeDate.fill("2027-06-30");
  await page
    .locator('[data-requirement="R06"] select')
    .selectOption({ label: "experience_cert (1).pdf" });
  await expect(page.getByRole("alert")).toContainText("already matched");
  await expect(page.locator('[data-requirement="R06"] select')).toHaveValue("");
  await page.locator('[data-requirement="R02"] select').selectOption("");
  await expect(page.locator('[data-requirement="R02"] .status')).toHaveText(
    "Missing",
  );
  await page
    .locator('[data-requirement="R02"] select')
    .selectOption({ label: "03_tin_certificate.pdf" });
  if (await page.locator(".notice button").count())
    await page.locator(".notice button").click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "screenshots/statuses-english.png",
    fullPage: true,
  });
  report(
    "confirmed suggestions, sample resolution, undo/reassign, duplicate blocking and expiry before/on/after deadline",
  );

  await page
    .getByRole("button", { name: "Generate package", exact: true })
    .click();
  await page
    .getByText("Package generated successfully.", { exact: true })
    .waitFor();
  const final = await saveDownload(
    page,
    "Download PDF",
    "output/T-2026-0417_Package.pdf",
  );
  if (final.name !== "T-2026-0417_Package.pdf")
    throw Error("Wrong download filename");
  const pages = await textPages(final.bytes);
  if (pages.length !== 17) throw Error("Expected 17 pages with default index");
  pages.forEach((text, i) => {
    if (!text.includes(`T-2026-0417 | Page ${i + 1} of 17`))
      throw Error(`Missing footer on page ${i + 1}`);
  });
  for (const value of [
    "TENDER DOCUMENT PACKAGE",
    "T-2026-0417",
    "Supply of IT Equipment",
    "Directorate of Sample Services",
    "Meghna Tech Solutions Ltd.",
    "2026-10-20",
    "PACKAGE CREATION DATE",
  ])
    if (!pages[0].includes(value)) throw Error(`Missing cover field ${value}`);
  const starts = {
    "trade_license_2026.pdf": 3,
    "03_tin_certificate.pdf": 4,
    "04_vat_certificate.pdf": 5,
    "bank_solvency.pdf": 6,
    "experience_cert.pdf": 7,
    "02_technical_proposal.pdf": 9,
    "01_financial_proposal.pdf": 15,
    "scan_0042.pdf": 17,
  };
  const names = [
    "Trade License",
    "TIN Certificate",
    "VAT Registration Certificate",
    "Bank Solvency Certificate",
    "Experience Certificate",
    "Technical Proposal",
    "Financial Proposal",
    "Signed Declaration",
  ];
  let cursor = -1;
  names.forEach((name, i) => {
    const position = pages[1].indexOf(name);
    if (
      position <= cursor ||
      !pages[1].includes(`${name} ${Object.values(starts)[i]}`)
    )
      throw Error("Index order/start incorrect");
    cursor = position;
  });
  for (const [name, start] of Object.entries(starts)) {
    const source = await textPages(await readFile(asset(name)));
    source.forEach((text, i) => {
      if (text && !pages[start - 1 + i].includes(text))
        throw Error(`Original content/order changed: ${name}, page ${i + 1}`);
    });
  }
  await page.waitForFunction(
    () =>
      document.querySelector("canvas")?.dataset.renderedPage === "1" &&
      !document.querySelector(".rendering"),
  );
  await page.screenshot({
    path: "screenshots/package-preview.png",
    fullPage: true,
  });
  report(
    "17-page output artifact, English cover, every footer, index references and original text/page ordering",
  );

  await page.getByLabel("Include document index", { exact: true }).uncheck();
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Generate package", exact: true })
    .click();
  await page
    .getByText("Package generated successfully.", { exact: true })
    .waitFor();
  const noIndex = await saveDownload(
    page,
    "Download PDF",
    ".test-results/without-index.pdf",
  );
  if ((await PDFDocument.load(noIndex.bytes)).getPageCount() !== 16)
    throw Error("Expected 16 pages without index");
  await page.getByLabel("Include document index", { exact: true }).check();
  await page
    .locator('input[aria-label="Upload PNG"]')
    .setInputFiles(asset("company_logo.png"));
  await page.getByText("company_logo.png", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Place on this page", exact: true })
    .click();
  await expect(page.locator(".stamp-overlay")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Generate package", exact: true })
    .click();
  await page
    .getByText("Package generated successfully.", { exact: true })
    .waitFor();
  const stamped = await saveDownload(
    page,
    "Download PDF",
    ".test-results/stamped.pdf",
  );
  const stampedPdf = await PDFDocument.load(stamped.bytes);
  if (
    !stampedPdf
      .getPage(0)
      .node.Resources()
      .lookup(PDFName.of("XObject"), PDFDict)
      .keys().length
  )
    throw Error("PNG not embedded on chosen page");
  report(
    "16-page mode, stale download prevention, SVG controls and preview-based PNG placement",
  );

  await page
    .getByRole("button", { name: "Project tools", exact: true })
    .click();
  await page
    .getByLabel("Your Gemini API key", { exact: true })
    .fill("verification-placeholder-not-a-secret");
  const saved = await saveDownload(
    page,
    "Save project",
    ".test-results/sample.tender-project.json",
  );
  if (
    saved.bytes.includes(Buffer.from("verification-placeholder-not-a-secret"))
  )
    throw Error("API key leaked into project");
  const project = JSON.parse(saved.bytes.toString("utf8"));
  if (
    project.files.length !== 10 ||
    Object.keys(project.assignments).length !== 8 ||
    !project.stamp.placements.cover
  )
    throw Error("Incomplete saved project");
  const csv = await saveDownload(
    page,
    "Export checklist CSV",
    ".test-results/checklist.csv",
  );
  if (
    csv.bytes[0] !== 239 ||
    !csv.bytes
      .toString("utf8")
      .includes(
        '"Trade License","trade_license_2026.pdf","1","2027-06-30","OK"',
      )
  )
    throw Error("CSV contents");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.locator('[data-requirement="R02"] select').selectOption("");
  await page
    .getByRole("button", { name: "Project tools", exact: true })
    .click();
  let sent;
  await page.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      suggestions: [
                        {
                          requirementId: "R02",
                          fileId: project.assignments.R02,
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
    },
  );
  await page
    .getByRole("button", { name: "Ask for match suggestions", exact: true })
    .click();
  await expect(page.locator(".suggestion")).toHaveCount(1);
  await page
    .locator(".suggestion")
    .getByRole("button", { name: "Confirm match" })
    .click();
  const metadata = JSON.parse(sent.contents[0].parts[0].text);
  if (
    Object.keys(metadata.files[0]).join(",") !== "id,name" ||
    JSON.stringify(sent).includes("bytes")
  )
    throw Error("AI payload includes document content");
  await page.unroute("https://generativelanguage.googleapis.com/**");
  await page.route("https://generativelanguage.googleapis.com/**", (route) =>
    route.fulfill({ status: 429, contentType: "application/json", body: "{}" }),
  );
  await page
    .getByRole("button", { name: "Ask for match suggestions", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "AI suggestions are unavailable",
  );
  await page
    .locator('input[aria-label="Reopen project"]')
    .setInputFiles({
      name: "invalid-project.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(page.getByRole("alert")).toContainText("Invalid project file");
  await page
    .locator('input[aria-label="Reopen project"]')
    .setInputFiles(".test-results/sample.tender-project.json");
  await page.getByText("Project restored.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".status.ok")).toHaveCount(8);
  report(
    "CSV export, project round-trip, invalid project isolation, memory-only key and AI success/failure with metadata-only mocked requests",
  );

  await page
    .getByRole("button", { name: "Switch language", exact: true })
    .click();
  await page.getByText("ট্রেড লাইসেন্স", { exact: true }).waitFor();
  await expect(page.locator(".status.ok")).toHaveText(Array(8).fill("ঠিক আছে"));
  await page.screenshot({
    path: "screenshots/statuses-bangla.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "প্যাকেজ তৈরি করুন", exact: true })
    .click();
  await page
    .getByText("প্যাকেজ সফলভাবে তৈরি হয়েছে।", { exact: true })
    .waitFor();
  const bengali = await saveDownload(
    page,
    "পিডিএফ ডাউনলোড",
    ".test-results/bangla.pdf",
  );
  const bnPdf = await PDFDocument.load(bengali.bytes);
  if (
    bnPdf.getPageCount() !== 17 ||
    bnPdf
      .getPage(1)
      .node.Resources()
      .lookup(PDFName.of("XObject"), PDFDict)
      .keys().length < 8
  )
    throw Error("Bangla index images not embedded");
  if (!(await textPages(bengali.bytes))[0].includes("TENDER DOCUMENT PACKAGE"))
    throw Error("Cover must remain English");
  await page.getByRole("button", { name: "পরের পৃষ্ঠা", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("canvas")?.dataset.renderedPage === "2" &&
      !document.querySelector(".rendering"),
  );
  await page.screenshot({
    path: "screenshots/index-bangla.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "সারসংক্ষেপ", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    !(await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ))
  )
    throw Error("Mobile horizontal overflow");
  await page.screenshot({
    path: "screenshots/mobile-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.addStyleTag({ content: "html{font-size:32px}" });
  if (
    !(await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ))
  )
    throw Error("200% text horizontal overflow");
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === "bn");
  await page.keyboard.press("Tab");
  if (!(await page.evaluate(() => document.activeElement?.tagName === "A")))
    throw Error("Keyboard navigation unavailable");
  report(
    "Bangla UI/PDF index, English cover, remembered language, mobile layout, 200% text and keyboard access",
  );

  const capacity = await browser.newPage();
  capacity.on("pageerror", (error) => failures.push(error.message));
  await capacity.goto(base);
  const source = await readFile(asset("trade_license_2026.pdf"));
  await capacity
    .locator('input[aria-label="Upload PDFs"]')
    .setInputFiles(
      Array.from({ length: 31 }, (_, i) => ({
        name: `copy-${i}.pdf`,
        mimeType: "application/pdf",
        buffer: source,
      })),
    );
  await expect(capacity.locator(".file-item")).toHaveCount(30);
  await expect(capacity.getByRole("alert")).toContainText("30 PDF files");
  await capacity
    .getByRole("button", { name: "Remove file copy-0.pdf", exact: true })
    .click();
  await expect(capacity.locator(".file-item")).toHaveCount(29);
  await capacity.close();
  const large = await browser.newPage();
  await large.goto(base);
  await large.evaluate(() => {
    const input = document.querySelector('input[aria-label="Upload PDFs"]');
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(50 * 1024 * 1024 + 1)], "too-large.pdf", {
        type: "application/pdf",
      }),
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(large.getByRole("alert")).toContainText("50 MB");
  await expect(large.locator(".file-item")).toHaveCount(0);
  await large.close();
  report("30-file upload boundary, removal and oversized PDF rejection");
  if (failures.length) throw Error(failures.join("\n"));
  console.log(
    "All Chrome production checks passed. Artifacts saved in output/ and screenshots/.",
  );
} finally {
  await browser?.close();
  server?.kill();
}

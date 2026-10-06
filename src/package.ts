import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import type {
  Assignments,
  Expiries,
  Requirements,
  UploadedPDF,
  PackageOptions,
} from "./types";
import { checklist, isBlocking } from "./core";
import { translate } from "./i18n";
export interface GeneratedPackage {
  bytes: Uint8Array;
  pages: number;
  pageKeys: string[];
  starts: Record<string, number>;
  previewBytes: Uint8Array;
  pageSizes: { width: number; height: number }[];
}
const FOOTER = 40;
function measure(text: string, font: PDFFont, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${size}px Bengali, sans-serif`;
    return ctx.measureText(text).width;
  }
}
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, font, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}
export async function generatePackage(
  data: Requirements,
  files: UploadedPDF[],
  assignments: Assignments,
  expiries: Expiries,
  options: PackageOptions = { index: false, language: "en" },
): Promise<GeneratedPackage> {
  const rows = checklist(data, files, assignments, expiries);
  if (rows.some((r) => isBlocking(r.status))) throw new Error("blocking");
  const included = rows.filter((r) => r.file);
  if (new Set(included.map((r) => r.file!.hash)).size !== included.length)
    throw new Error("duplicate");
  if (typeof document !== "undefined") {
    await document.fonts.load("16px Bengali");
    await document.fonts.ready;
  }
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cover = pdf.addPage([595.28, 841.89]);
  const pageKeys = ["cover"];
  const starts: Record<string, number> = {};
  const ink = rgb(0.08, 0.16, 0.25),
    muted = rgb(0.35, 0.43, 0.51),
    teal = rgb(0.08, 0.48, 0.45);
  const pending: Promise<void>[] = [];
  const write = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    size = 11,
    strong = false,
    color = ink,
  ) => {
    const chosen = strong ? bold : font;
    try {
      chosen.encodeText(text);
      page.drawText(text, { x, y, size, font: chosen, color });
    } catch {
      const scale = 3;
      const canvas = document.createElement("canvas");
      const width = measure(text, chosen, size);
      canvas.width = Math.ceil((width + 4) * scale);
      canvas.height = Math.ceil(size * 2.4 * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.font = `${strong ? "600" : "400"} ${size}px Bengali, sans-serif`;
      ctx.fillStyle = `rgb(${Math.round(color.red * 255)},${Math.round(color.green * 255)},${Math.round(color.blue * 255)})`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, 0, size * 1.7);
      pending.push(
        (async () => {
          const image = await pdf.embedPng(canvas.toDataURL("image/png"));
          page.drawImage(image, {
            x,
            y: y - size * 0.7,
            width: canvas.width / scale,
            height: canvas.height / scale,
          });
        })(),
      );
    }
  };
  cover.drawRectangle({ x: 0, y: 810, width: 595.28, height: 32, color: teal });
  cover.drawText("TENDER DOCUMENT PACKAGE", {
    x: 40,
    y: 767,
    size: 11,
    font: bold,
    color: teal,
  });
  let y = 730;
  for (const line of wrap(data.tender.title, bold, 22, 515)) {
    write(cover, line, 40, y, 22, true);
    y -= 29;
  }
  y -= 18;
  const values = [
    ["Tender ID", data.tender.tender_id],
    ["Procuring entity", data.tender.procuring_entity],
    ["Bidder", data.tender.bidder],
    ["Submission deadline", data.tender.submission_deadline],
    [
      "Package creation date",
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    ],
  ];
  for (const [label, value] of values) {
    cover.drawText(label.toUpperCase(), {
      x: 40,
      y,
      size: 8,
      font: bold,
      color: muted,
    });
    y -= 19;
    for (const line of wrap(value, font, 11, 515)) {
      write(cover, line, 40, y);
      y -= 15;
    }
    y -= 13;
  }
  y -= 8;
  write(cover, "Included documents (submission order)", 40, y, 12, true);
  y -= 26;
  let size = 11;
  let docLines = included.map((r, i) =>
    wrap(`${i + 1}. ${r.requirement.title_en}`, font, size, 515),
  );
  while (
    docLines.reduce((n, ls) => n + ls.length, 0) * (size + 5) > y - 65 &&
    size > 7
  ) {
    size -= 0.5;
    docLines = included.map((r, i) =>
      wrap(`${i + 1}. ${r.requirement.title_en}`, font, size, 515),
    );
  }
  for (const lines of docLines)
    for (const line of lines) {
      write(cover, line, 40, y, size);
      y -= size + 5;
    }
  if (y < 45) throw new Error("cover too long");
  if (options.index) {
    const entries: { text: string; row: number; first: boolean }[] = [];
    included.forEach((r, i) =>
      wrap(
        options.language === "bn"
          ? r.requirement.title_bn
          : r.requirement.title_en,
        font,
        11,
        430,
      ).forEach((text, j) => entries.push({ text, row: i, first: j === 0 })),
    );
    const perPage = 32;
    const indexPages = Math.max(1, Math.ceil(entries.length / perPage));
    let nextStart = 2 + indexPages;
    for (const row of included) {
      starts[row.requirement.id] = nextStart;
      nextStart += row.file!.pages;
    }
    for (let i = 0; i < indexPages; i++) {
      const page = pdf.addPage([595.28, 841.89]);
      pageKeys.push(`index:${i}`);
      page.drawRectangle({
        x: 0,
        y: 810,
        width: 595.28,
        height: 32,
        color: teal,
      });
      write(
        page,
        options.language === "bn" ? "নথির সূচি" : "Document index",
        40,
        758,
        22,
        true,
      );
      write(page, translate(options.language, "document"), 40, 722, 10, true);
      write(page, translate(options.language, "page"), 508, 722, 10, true);
      page.drawLine({
        start: { x: 40, y: 708 },
        end: { x: 555, y: 708 },
        color: rgb(0.83, 0.87, 0.89),
      });
      entries.slice(i * perPage, (i + 1) * perPage).forEach((entry, j) => {
        const top = 685 - j * 19;
        write(page, entry.text, 40, top, 11);
        if (entry.first)
          write(
            page,
            String(starts[included[entry.row].requirement.id]),
            515,
            top,
            11,
          );
      });
    }
  }
  for (const row of included) {
    const source = await PDFDocument.load(row.file!.bytes);
    starts[row.requirement.id] = pdf.getPageCount() + 1;
    for (let i = 0; i < source.getPageCount(); i++) {
      const original = source.getPage(i);
      const crop = original.getCropBox();
      const embedded = await pdf.embedPage(original, {
        left: crop.x,
        bottom: crop.y,
        right: crop.x + crop.width,
        top: crop.y + crop.height,
      });
      const angle = ((original.getRotation().angle % 360) + 360) % 360;
      const rotated = angle === 90 || angle === 270;
      const width = rotated ? embedded.height : embedded.width;
      const height = rotated ? embedded.width : embedded.height;
      const page = pdf.addPage([width, height + FOOTER]);
      const placement =
        angle === 90
          ? { x: 0, y: embedded.width + FOOTER, rotate: degrees(-90) }
          : angle === 180
            ? {
                x: embedded.width,
                y: embedded.height + FOOTER,
                rotate: degrees(180),
              }
            : angle === 270
              ? { x: embedded.height, y: FOOTER, rotate: degrees(90) }
              : { x: 0, y: FOOTER, rotate: degrees(0) };
      page.drawPage(embedded, placement);
      pageKeys.push(`${row.requirement.id}:${row.file!.hash}:${i}`);
    }
  }
  const total = pdf.getPageCount();
  pdf.getPages().forEach((page, i) => {
    const text = `${data.tender.tender_id} | Page ${i + 1} of ${total}`;
    const width = page.getWidth();
    const size = Math.min(9, (width - 32) / measure(text, font, 1));
    page.drawLine({
      start: { x: 16, y: 32 },
      end: { x: width - 16, y: 32 },
      color: rgb(0.83, 0.87, 0.89),
      thickness: 0.5,
    });
    write(
      page,
      text,
      (width - measure(text, font, size)) / 2,
      14,
      size,
      false,
      muted,
    );
  });
  pdf.setTitle(`${data.tender.tender_id} Tender Document Package`);
  pdf.setAuthor(data.tender.bidder);
  pdf.setCreator("TenderDesk");
  await Promise.all(pending);
  const pageSizes = pdf
    .getPages()
    .map((p) => ({ width: p.getWidth(), height: p.getHeight() }));
  const previewBytes = await pdf.save();
  if (options.stamp && Object.keys(options.stamp.placements).length) {
    const png = await pdf.embedPng(options.stamp.bytes);
    pdf.getPages().forEach((page, i) => {
      const placement = options.stamp!.placements[pageKeys[i]];
      if (!placement) return;
      const maxWidth = Math.min(
        page.getWidth() * 0.6,
        ((page.getHeight() - FOOTER) * png.width) / png.height,
      );
      const width = Math.min(placement.width * page.getWidth(), maxWidth);
      const height = (width * png.height) / png.width;
      const x = Math.max(
        0,
        Math.min(placement.x * page.getWidth(), page.getWidth() - width),
      );
      const top = Math.max(
        0,
        Math.min(
          placement.y * page.getHeight(),
          page.getHeight() - FOOTER - height,
        ),
      );
      page.drawImage(png, {
        x,
        y: page.getHeight() - top - height,
        width,
        height,
      });
    });
    return {
      bytes: await pdf.save(),
      pages: total,
      pageKeys,
      starts,
      previewBytes,
      pageSizes,
    };
  }
  return {
    bytes: previewBytes,
    pages: total,
    pageKeys,
    starts,
    previewBytes,
    pageSizes,
  };
}

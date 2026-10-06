import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import {
  aiSuggestions,
  exportCSV,
  exportProject,
  importProject,
  inspectPNG,
  suggestMatches,
} from "./bonus";
import { inspectPDF, validateRequirements } from "./core";
import { generatePackage } from "./package";
import type { Project } from "./bonus";
const data = validateRequirements(
  JSON.parse(readFileSync("public/sample-pack/requirements.json", "utf8")),
);
async function project(): Promise<Project> {
  const file = await inspectPDF(
    new File(
      [readFileSync("public/sample-pack/documents/experience_cert.pdf")],
      "experience_cert.pdf",
    ),
  );
  return {
    data,
    files: [file],
    assignments: { R05: file.id },
    expiries: {},
    index: true,
    language: "bn",
  };
}
describe("project files", () => {
  it("restores bytes, hashes, language and assignments", async () => {
    const original = await project();
    const restored = await importProject(exportProject(original));
    expect(restored.files[0].hash).toBe(original.files[0].hash);
    expect(restored.assignments).toEqual(original.assignments);
    expect(restored.language).toBe("bn");
    expect(restored.index).toBe(true);
  });
  it("revalidates uploaded PDF content", async () => {
    const parsed = JSON.parse(exportProject(await project()));
    parsed.files[0].bytes = btoa("not a pdf");
    await expect(importProject(JSON.stringify(parsed))).rejects.toThrow(
      "projectError",
    );
  });
  it("rejects duplicate-content matches and mismatched IDs", async () => {
    const p = await project();
    const duplicate = { ...p.files[0], id: "duplicate" };
    p.files.push(duplicate);
    p.assignments.R06 = "duplicate";
    await expect(importProject(exportProject(p))).rejects.toThrow(
      "projectError",
    );
    p.assignments = { R05: "unknown" };
    await expect(importProject(exportProject(p))).rejects.toThrow(
      "projectError",
    );
  });
  it("rejects invalid version, JSON, dates and excess files", async () => {
    await expect(importProject("invalid")).rejects.toThrow("projectError");
    const parsed = JSON.parse(exportProject(await project()));
    parsed.version = 2;
    await expect(importProject(JSON.stringify(parsed))).rejects.toThrow(
      "projectError",
    );
    parsed.version = 1;
    parsed.expiries = { R05: "2026-02-30" };
    await expect(importProject(JSON.stringify(parsed))).rejects.toThrow(
      "projectError",
    );
    parsed.files = Array.from({ length: 31 }, () => parsed.files[0]);
    await expect(importProject(JSON.stringify(parsed))).rejects.toThrow(
      "projectError",
    );
  });
  it("keeps API keys out of exported files", async () =>
    expect(exportProject(await project())).not.toContain("apiKey"));
});
describe("CSV and filename suggestions", () => {
  it("exports Bangla with a BOM and exact statuses", async () => {
    const p = await project();
    const csv = exportCSV(p.data, p.files, p.assignments, p.expiries, "bn");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("অভিজ্ঞতার সনদ");
    expect(csv).toContain("ঠিক আছে");
  });
  it("escapes formula-like cells and quotes", async () => {
    const p = await project();
    p.data = {
      ...p.data,
      requirements: [{ ...data.requirements[4], title_en: '=SUM(1,2) "test"' }],
    };
    expect(exportCSV(p.data, p.files, p.assignments, {}, "en")).toContain(
      `"'=SUM(1,2) ""test"""`,
    );
  });
  it("suggests experience certificate once for duplicate content", async () => {
    const p = await project();
    p.files.push({ ...p.files[0], id: "dup", name: "experience_cert (1).pdf" });
    const suggested = suggestMatches(p.data, p.files, {});
    expect(suggested).toHaveLength(1);
    expect(suggested[0].requirementId).toBe("R05");
    expect(suggestMatches(p.data, p.files, p.assignments)).toEqual([]);
  });
  it("does not guess which trade license to choose", async () => {
    const files = await Promise.all(
      ["trade_license_2025.pdf", "trade_license_2026.pdf"].map(async (name) =>
        inspectPDF(
          new File(
            [readFileSync(`public/sample-pack/documents/${name}`)],
            name,
          ),
        ),
      ),
    );
    expect(suggestMatches(data, files, {})).toEqual([]);
  });
});
describe("PNG and PDF bonuses", () => {
  it("rejects invalid PNGs", async () => {
    await expect(inspectPNG(new File(["png"], "seal.png"))).rejects.toThrow(
      "pngError",
    );
  });
  it("restores PNG placements and excludes invalid coordinates", async () => {
    const p = await project();
    p.stamp = await inspectPNG(
      new File(
        [readFileSync("public/sample-pack/documents/company_logo.png")],
        "seal.png",
      ),
    );
    p.stamp.placements.cover = { x: 0.4, y: 0.5, width: 0.2 };
    const restored = await importProject(exportProject(p));
    expect(restored.stamp?.width).toBe(p.stamp.width);
    expect(restored.stamp?.placements).toEqual(p.stamp.placements);
    p.stamp.placements.cover.x = 2;
    await expect(importProject(exportProject(p))).rejects.toThrow(
      "projectError",
    );
  });
  it("adds an index and a stamp without corrupting the base preview", async () => {
    const p = await project();
    p.data = { ...data, requirements: [data.requirements[4]] };
    p.stamp = await inspectPNG(
      new File(
        [readFileSync("public/sample-pack/documents/company_logo.png")],
        "seal.png",
      ),
    );
    p.stamp.placements.cover = { x: 0.6, y: 0.7, width: 0.2 };
    const out = await generatePackage(
      p.data,
      p.files,
      p.assignments,
      {},
      { index: true, language: "en", stamp: p.stamp },
    );
    expect(out.pages).toBe(4);
    expect(out.starts.R05).toBe(3);
    expect(out.pageKeys[1]).toBe("index:0");
    const stamped = await PDFDocument.load(out.bytes);
    const base = await PDFDocument.load(out.previewBytes);
    const resources = stamped.getPage(0).node.Resources()!;
    expect(
      resources.lookup(PDFName.of("XObject"), PDFDict).keys().length,
    ).toBeGreaterThan(0);
    expect(
      base
        .getPage(0)
        .node.Resources()
        ?.lookup(PDFName.of("XObject"), PDFDict)
        .keys().length || 0,
    ).toBe(0);
  });
});
describe("optional AI with metadata only", () => {
  it("sends only names and titles and returns known IDs", async () => {
    const p = await project();
    let payload = "";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, options) => {
        payload = String(options?.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        suggestions: [
                          { requirementId: "R05", fileId: p.files[0].id },
                          { requirementId: "invented", fileId: "bad" },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      });
    try {
      expect(
        await aiSuggestions(
          p.data,
          p.files,
          "verification-placeholder",
          "gemini-2.5-flash",
        ),
      ).toHaveLength(1);
      const request = JSON.parse(payload);
      const input = JSON.parse(request.contents[0].parts[0].text);
      expect(Object.keys(input.files[0])).toEqual(["id", "name"]);
      expect(Object.keys(input.requirements[0])).toEqual([
        "id",
        "title_en",
        "title_bn",
      ]);
      expect(payload).not.toContain("bytes");
      expect(payload).not.toContain("verification-placeholder");
    } finally {
      fetchMock.mockRestore();
    }
  });
  it("fails clearly when the API is unavailable", async () => {
    const p = await project();
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    try {
      await expect(
        aiSuggestions(
          p.data,
          p.files,
          "verification-placeholder",
          "gemini-2.5-flash",
        ),
      ).rejects.toThrow("aiError");
    } finally {
      mock.mockRestore();
    }
  });
});

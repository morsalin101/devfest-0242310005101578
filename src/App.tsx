import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import OverviewPage from "./pages/OverviewPage";
import DocumentsPage from "./pages/DocumentsPage";
import type { ChangeEvent } from "react";
import type {
  Language,
  Requirements,
  UploadedPDF,
  Assignments,
  Expiries,
  Stamp,
  Suggestion,
} from "./types";
import {
  InputError,
  inspectPDF,
  assertUploadCapacity,
  sampleFiles,
  validateRequirements,
  checklist,
  isBlocking,
  assignFile,
  download,
  safeFilename,
} from "./core";
import { translate } from "./i18n";
import type { MessageKey } from "./i18n";
import { Icon } from "./Icon";
import Preview from "./Preview";
import { generatePackage } from "./package";
import type { GeneratedPackage } from "./package";
import {
  exportProject,
  importProject,
  exportCSV,
  inspectPNG,
  suggestMatches,
  aiSuggestions,
  checkedSample,
} from "./bonus";

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("tenderdesk-language") === "bn" ? "bn" : "en";
    } catch {
      return "en";
    }
  });
  const t = (key: MessageKey) => translate(language, key);
  const [data, setData] = useState<Requirements>();
  const [files, setFiles] = useState<UploadedPDF[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [expiries, setExpiries] = useState<Expiries>({});
  const [generated, setGenerated] = useState<GeneratedPackage>();
  const [stale, setStale] = useState(false);
  const [packagePage, setPackagePage] = useState(1);
  const [includeIndex, setIncludeIndex] = useState(true);
  const [stamp, setStamp] = useState<Stamp>();
  const [stampWidth, setStampWidth] = useState(0.24);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const projectInput = useRef<HTMLInputElement>(null);
  const stampInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [notices, setNotices] = useState<
    { key: MessageKey; detail?: string; error?: boolean }[]
  >([]);
  const location = useLocation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>();
  const [previewPage, setPreviewPage] = useState(1);
  const requirementsInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("tenderdesk-language", language);
    } catch {
      /* Preferences are optional. */
    }
  }, [language]);
  const notice = (key: MessageKey, detail?: string, error = false) =>
    setNotices([{ key, detail, error }]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotices([]);
    try {
      await action();
    } catch (e) {
      notice(e instanceof InputError ? e.code : "loadError", undefined, true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function importRequirements(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await run(async () => {
      let parsed: Requirements;
      try {
        parsed = validateRequirements(JSON.parse(await file.text()));
      } catch {
        throw new InputError("jsonError");
      }
      if (data && !window.confirm(t("confirmReplace"))) return;
      setData(parsed);
      setSuggestions([]);
      setStamp(undefined);
      setAssignments({});
      setExpiries({});
      setGenerated(undefined);
      setStale(false);
      notice("requirementsLoaded");
    });
  }
  async function upload(incoming: File[]) {
    await run(async () => {
      const accepted = [...files];
      const errors: { key: MessageKey; detail: string; error: boolean }[] = [];
      for (const file of incoming) {
        try {
          assertUploadCapacity(
            accepted.length,
            accepted.reduce((n, f) => n + f.size, 0),
            file.size,
          );
          accepted.push(await inspectPDF(file));
        } catch (e) {
          errors.push({
            key: e instanceof InputError ? e.code : "damaged",
            detail: file.name,
            error: true,
          });
        }
      }
      setFiles(accepted);
      setNotices(errors);
      setStale(true);
      if (!selected && accepted[0]) {
        setSelected(accepted[0].id);
        setPreviewPage(1);
      }
    });
  }
  async function loadSample() {
    await run(async () => {
      if ((data || files.length) && !window.confirm(t("sampleReplace"))) return;
      const response = await fetch("/sample-pack/requirements.json");
      if (!response.ok) throw new Error("sample");
      const sampleData = validateRequirements(await response.json());
      const loaded: UploadedPDF[] = [];
      for (const name of sampleFiles) {
        const res = await fetch(
          `/sample-pack/documents/${encodeURIComponent(name)}`,
        );
        if (!res.ok) throw new Error("sample");
        loaded.push(
          await inspectPDF(
            new File([await res.blob()], name, { type: "application/pdf" }),
          ),
        );
      }
      setData(sampleData);
      setSuggestions([]);
      setStamp(undefined);
      setFiles(loaded);
      setAssignments({});
      setExpiries({});
      setGenerated(undefined);
      setStale(false);
      setSelected(loaded[0].id);
      setPreviewPage(1);
      notice("sampleLoaded");
    });
  }
  function removeFile(id: string) {
    const next = { ...assignments };
    const dates = { ...expiries };
    for (const [r, f] of Object.entries(next))
      if (f === id) {
        delete next[r];
        delete dates[r];
      }
    setAssignments(next);
    setExpiries(dates);
    setFiles(files.filter((f) => f.id !== id));
    setStale(true);
    if (selected === id) {
      setSelected(undefined);
      setPreviewPage(1);
    }
    notice("fileRemoved");
  }
  function match(requirementId: string, fileId: string) {
    try {
      setAssignments(assignFile(requirementId, fileId, assignments, files));
      const next = { ...expiries };
      delete next[requirementId];
      setExpiries(next);
      setStale(true);
      setNotices([]);
      setSuggestions(
        suggestions.filter(
          (s) => s.requirementId !== requirementId && s.fileId !== fileId,
        ),
      );
    } catch (e) {
      notice(
        e instanceof InputError ? e.code : "matchConflict",
        undefined,
        true,
      );
    }
  }
  const rows = data ? checklist(data, files, assignments, expiries) : [];
  const blockers = rows.filter((r) => isBlocking(r.status));
  const blocking = blockers.length;
  const ready = rows.filter((r) => r.status === "ok").length;
  const progress = rows.length
    ? Math.round(
        (rows.filter((r) => !isBlocking(r.status)).length / rows.length) * 100,
      )
    : 0;
  async function generate() {
    if (!data || blocking || busy) return;
    await run(async () => {
      try {
        const result = await generatePackage(
          data,
          files,
          assignments,
          expiries,
          { index: includeIndex, language, stamp },
        );
        setGenerated(result);
        setStale(false);
        setPackagePage(1);
        navigate("/package");
        notice("generated");
      } catch {
        notice("generationError", undefined, true);
      }
    });
  }
  function downloadPackage() {
    if (generated && data && !stale)
      download(
        generated.bytes,
        `${safeFilename(data.tender.tender_id)}_Package.pdf`,
        "application/pdf",
      );
  }
  const totalPages = files.reduce((n, f) => n + f.pages, 0);

  function saveProject() {
    if (!data) return;
    try {
      download(
        exportProject({
          data,
          files,
          assignments,
          expiries,
          index: includeIndex,
          language,
          stamp,
        }),
        `${safeFilename(data.tender.tender_id)}.tender-project.json`,
        "application/json",
      );
      notice("projectSaved");
    } catch {
      notice("exportError", undefined, true);
    }
  }
  async function reopenProject(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run(async () => {
      if (file.size > 80 * 1024 * 1024) throw new InputError("projectError");
      const project = await importProject(await file.text());
      if ((data || files.length) && !window.confirm(t("confirmProject")))
        return;
      setData(project.data);
      setFiles(project.files);
      setAssignments(project.assignments);
      setExpiries(project.expiries);
      setIncludeIndex(project.index);
      setLanguage(project.language);
      setStamp(project.stamp);
      setGenerated(undefined);
      setStale(false);
      setSuggestions([]);
      setSelected(project.files[0]?.id);
      setPreviewPage(1);
      setPackagePage(1);
      notice("projectLoaded");
    });
  }
  async function loadStamp(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await run(async () => {
      try {
        setStamp(await inspectPNG(file));
        setStale(true);
      } catch {
        notice("pngError", undefined, true);
      }
    });
  }
  function placeStamp(x: number, y: number) {
    if (!stamp || !generated) return;
    const key = generated.pageKeys[packagePage - 1];
    const size = generated.pageSizes[packagePage - 1];
    const width = Math.min(
      stampWidth,
      (((size.height - 40) / size.width) * stamp.width) / stamp.height,
    );
    const height =
      (width * size.width * stamp.height) / stamp.width / size.height;
    const position = {
      x: Math.max(0, Math.min(x, 1 - width)),
      y: Math.max(0, Math.min(y, 1 - 40 / size.height - height)),
      width,
    };
    setStamp({
      ...stamp,
      placements: { ...stamp.placements, [key]: position },
    });
    setStale(true);
    notice("sealPlaced");
  }
  function removePlacement() {
    if (!stamp || !generated) return;
    const placements = { ...stamp.placements };
    delete placements[generated.pageKeys[packagePage - 1]];
    setStamp({ ...stamp, placements });
    setStale(true);
  }
  function suggest() {
    if (!data) return;
    const found = suggestMatches(data, files, assignments);
    setSuggestions(found);
    notice(found.length ? "suggestedHelp" : "noSuggestions");
  }
  async function askAI() {
    if (!data || !files.length) {
      notice("aiEmpty", undefined, true);
      return;
    }
    await run(async () => {
      try {
        const found = await aiSuggestions(data, files, apiKey, model);
        const filtered = found.filter(
          (s) =>
            !assignments[s.requirementId] &&
            !Object.values(assignments).includes(s.fileId),
        );
        setSuggestions(filtered);
        notice(filtered.length ? "suggestedHelp" : "noSuggestions");
      } catch {
        notice("aiError", undefined, true);
      }
    });
  }
  async function resolveSample() {
    await run(async () => {
      const response = await fetch("/sample-pack/requirements.json");
      if (!response.ok) throw new Error();
      const original = validateRequirements(await response.json());
      if (!data || JSON.stringify(data) !== JSON.stringify(original)) {
        notice("sampleMismatch", undefined, true);
        return;
      }
      let next: Assignments = {};
      const dates: Expiries = {};
      for (const [id, checked] of Object.entries(checkedSample)) {
        const file = files.find(
          (f) => f.name === checked.name && f.hash.startsWith(checked.hash),
        );
        if (!file) {
          notice("sampleMismatch", undefined, true);
          return;
        }
        next = assignFile(id, file.id, next, files);
        if (checked.expiry) dates[id] = checked.expiry;
      }
      setAssignments(next);
      setExpiries(dates);
      setSuggestions([]);
      setStale(true);
      notice("resolved");
      navigate("/documents");
    });
  }
  const suggestionPanel = suggestions.length > 0 && (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{t("suggestions")}</h2>
          <p>{t("suggestedHelp")}</p>
        </div>
        <button
          className="icon-button"
          aria-label={t("close")}
          onClick={() => setSuggestions([])}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="suggestion-list">
        {suggestions.map((s, i) => {
          const r = data?.requirements.find((r) => r.id === s.requirementId);
          const f = files.find((f) => f.id === s.fileId);
          if (!r || !f) return null;
          return (
            <div className="suggestion" key={`${s.requirementId}-${i}`}>
              <div>
                <strong>{language === "en" ? r.title_en : r.title_bn}</strong>
                <small>{f.name}</small>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => match(s.requirementId, s.fileId)}
              >
                <Icon name="check" size={16} />
                {t("confirm")}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
  const nav = [
    {
      path: "/overview",
      key: "overview",
      icon: "grid",
      heading: "overviewHeading",
      subtitle: "overviewSubtitle",
    },
    {
      path: "/documents",
      key: "documents",
      icon: "file",
      heading: "documentsHeading",
      subtitle: "documentsSubtitle",
    },
    {
      path: "/package",
      key: "package",
      icon: "package",
      heading: "package",
      subtitle: "packageHelp",
    },
    {
      path: "/tools",
      key: "tools",
      icon: "tools",
      heading: "tools",
      subtitle: "projectHelp",
    },
  ] as const;
  const currentPage =
    nav.find((n) => n.path === location.pathname.replace(/\/$/, "")) || nav[0];
  useEffect(() => {
    document.title = `${t(currentPage.key)} · TenderDesk`;
  }, [currentPage.key, language]);
  useEffect(() => {
    let target: HTMLElement | null = null;
    try {
      if (location.hash)
        target = document.getElementById(
          decodeURIComponent(location.hash.slice(1)),
        );
    } catch {
      /* Ignore invalid URL fragments. */
    }
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      document
        .querySelector<HTMLElement>("main h1")
        ?.focus({ preventScroll: true });
    }
  }, [location.pathname, location.hash]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/overview">
          <span className="brand-mark">
            <Icon name="file" size={25} />
          </span>
          <span>
            Tender<span className="brand-light">Desk</span>
            <small>{t("workspace")}</small>
          </span>
        </Link>
        <div className="sidebar-label">{t("eyebrow")}</div>
        <nav aria-label={t("navLabel")}>
          {nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={t(item.key)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon name={item.icon} />
              <span>{t(item.key)}</span>
              {item.path === "/documents" && files.length > 0 && (
                <span className="nav-count">{files.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy">
            <Icon name="lock" />
            <strong>{t("private")}</strong>
            <p>{t("privateHelp")}</p>
          </div>
          <div className="profile">
            <span className="avatar">MM</span>
            <div>
              <strong>Md.Morsalin</strong>
              <small>0242310005101578</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {t("workspace")}
            <Icon name="chevron" size={14} />
            <strong>{t(currentPage.key)}</strong>
          </div>
          <button
            className="language-button"
            aria-label={t("switch")}
            onClick={() => {
              setLanguage(language === "en" ? "bn" : "en");
              setStale(true);
            }}
          >
            <Icon name="globe" size={17} />
            <span>{language === "en" ? "বাংলা" : "English"}</span>
          </button>
        </header>
        <main>
          <section className="heading">
            <div>
              <div className="eyebrow">{t("eyebrow")}</div>
              <h1 tabIndex={-1}>{t(currentPage.heading)}</h1>
              <p>{t(currentPage.subtitle)}</p>
            </div>
            <div className="heading-actions">
              {currentPage.path === "/overview" && (
                <Link className="button primary" to="/documents">
                  <Icon name="file" size={17} />
                  {t("manageDocuments")}
                </Link>
              )}
              {currentPage.path === "/documents" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => filesInput.current?.click()}
                >
                  <Icon name="upload" size={17} />
                  {t("upload")}
                </button>
              )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => requirementsInput.current?.click()}
              >
                <Icon name="upload" size={17} />
                {t("import")}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={loadSample}
              >
                <Icon name="plus" size={17} />
                {t("sample")}
              </button>
            </div>
          </section>
          <input
            hidden
            ref={requirementsInput}
            type="file"
            accept=".json,application/json"
            aria-label={t("import")}
            onChange={importRequirements}
          />
          <input
            hidden
            ref={filesInput}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            aria-label={t("upload")}
            onChange={(e) => {
              const f = Array.from(e.target.files || []);
              e.target.value = "";
              void upload(f);
            }}
          />
          <input
            hidden
            ref={projectInput}
            type="file"
            accept=".json,application/json"
            aria-label={t("reopen")}
            onChange={reopenProject}
          />
          <input
            hidden
            ref={stampInput}
            type="file"
            accept=".png,image/png"
            aria-label={t("uploadSeal")}
            onChange={loadStamp}
          />
          {notices.map((n, i) => (
            <div
              key={i}
              className={`notice ${n.error ? "error" : "success"}`}
              role={n.error ? "alert" : "status"}
            >
              <Icon name={n.error ? "alert" : "check"} size={18} />
              <span>
                {n.detail && <strong>{n.detail}: </strong>}
                {t(n.key)}
              </span>
              <button
                className="icon-button"
                aria-label={t("close")}
                onClick={() => setNotices(notices.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          {busy && (
            <div className="notice" role="status">
              <span className="spinner" />
              {t("processing")}
            </div>
          )}
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route
              path="/overview"
              element={
                <OverviewPage
                  data={data}
                  language={language}
                  ready={ready}
                  blocking={blocking}
                  totalPages={totalPages}
                  progress={progress}
                  blockers={blockers}
                  fileCount={files.length}
                  busy={busy}
                  hasPackage={Boolean(generated)}
                  onGenerate={generate}
                  onOpenRequirements={() => requirementsInput.current?.click()}
                />
              }
            />
            <Route
              path="/documents"
              element={
                <DocumentsPage
                  data={data}
                  language={language}
                  files={files}
                  rows={rows}
                  assignments={assignments}
                  expiries={expiries}
                  busy={busy}
                  selected={selected}
                  previewPage={previewPage}
                  progress={progress}
                  blockers={blockers}
                  suggestionPanel={suggestionPanel}
                  onOpenRequirements={() => requirementsInput.current?.click()}
                  onOpenUpload={() => filesInput.current?.click()}
                  onSuggest={suggest}
                  onMatch={match}
                  onExpiry={(id, date) => {
                    setExpiries({ ...expiries, [id]: date });
                    setStale(true);
                  }}
                  onSelect={(id) => {
                    setSelected(id);
                    setPreviewPage(1);
                  }}
                  onRemove={removeFile}
                  onUpload={upload}
                  onGenerate={generate}
                  onPreviewPage={setPreviewPage}
                />
              }
            />
            <Route
              path="/package"
              element={
                <div className="package-layout">
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>{t("package")}</h2>
                        <p>{t("packageHelp")}</p>
                      </div>
                      <span className="count-badge">
                        {generated?.pages || 0} {t("pages")}
                      </span>
                    </div>
                    <div className="controls">
                      <button
                        className="button primary"
                        disabled={!generated || stale || busy}
                        onClick={downloadPackage}
                      >
                        <Icon name="download" size={17} />
                        {t("download")}
                      </button>
                      <button
                        className="button secondary"
                        disabled={!data || blocking > 0 || busy}
                        onClick={generate}
                      >
                        <Icon name="package" size={17} />
                        {t("generate")}
                      </button>
                      {stale && generated && (
                        <p className="stale-warning">{t("regenerate")}</p>
                      )}
                    </div>
                    <div className="package-output">
                      <Preview
                        bytes={generated?.previewBytes}
                        language={language}
                        page={packagePage}
                        onPage={setPackagePage}
                        stamp={stamp}
                        pageKey={generated?.pageKeys[packagePage - 1]}
                        onPlace={stamp && !busy ? placeStamp : undefined}
                      />
                    </div>
                  </section>
                  <div className="workspace-side">
                    <section className="panel tool-card">
                      <h2>{t("settings")}</h2>
                      <label className="option-label">
                        <input
                          type="checkbox"
                          checked={includeIndex}
                          disabled={busy}
                          onChange={(e) => {
                            setIncludeIndex(e.target.checked);
                            setStale(true);
                          }}
                        />
                        {t("index")}
                      </label>
                      <small>{t("indexHelp")}</small>
                      <p>
                        {t(
                          !data
                            ? "importFirst"
                            : blocking
                              ? "blockers"
                              : "readyHelp",
                        )}
                      </p>
                    </section>
                    {blocking > 0 && (
                      <section className="panel tool-card">
                        <h2>{t("attention")}</h2>
                        <ul className="blocker-list">
                          {blockers.map(({ requirement: r, status }) => (
                            <li key={r.id}>
                              <Link
                                to={`/documents#requirement-${encodeURIComponent(r.id)}`}
                              >
                                {language === "en" ? r.title_en : r.title_bn}:{" "}
                                {t(status)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <section className="panel tool-card">
                      <h2>{t("seal")}</h2>
                      <p>{t("sealHelp")}</p>
                      <button
                        className="button secondary wide"
                        disabled={busy}
                        onClick={() => stampInput.current?.click()}
                      >
                        <Icon name="upload" size={17} />
                        {t("uploadSeal")}
                      </button>
                      {stamp && (
                        <>
                          <small>{stamp.name}</small>
                          <label htmlFor="seal-width">
                            {t("sealWidth")}: {Math.round(stampWidth * 100)}%
                          </label>
                          <input
                            id="seal-width"
                            type="range"
                            min=".05"
                            max=".6"
                            step=".01"
                            value={stampWidth}
                            disabled={busy}
                            onChange={(e) =>
                              setStampWidth(Number(e.target.value))
                            }
                          />
                          <div className="tool-actions">
                            <button
                              className="button secondary"
                              disabled={!generated || busy}
                              onClick={() => placeStamp(0.6, 0.72)}
                            >
                              {t("placeSeal")}
                            </button>
                            <button
                              className="button secondary"
                              disabled={!generated || busy}
                              onClick={removePlacement}
                            >
                              {t("removePlacement")}
                            </button>
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() => {
                                setStamp(undefined);
                                setStale(true);
                              }}
                            >
                              {t("removeSeal")}
                            </button>
                          </div>
                        </>
                      )}
                      {!generated && <small>{t("sealFirst")}</small>}
                    </section>
                  </div>
                </div>
              }
            />
            <Route
              path="/tools"
              element={
                <>
                  <div className="tools-grid">
                    <section className="panel tool-card">
                      <h2>
                        {t("save")} / {t("reopen")}
                      </h2>
                      <p>{t("projectHelp")}</p>
                      <div className="tool-actions">
                        <button
                          className="button primary"
                          disabled={!data || busy}
                          onClick={saveProject}
                        >
                          <Icon name="save" size={17} />
                          {t("save")}
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => projectInput.current?.click()}
                        >
                          <Icon name="upload" size={17} />
                          {t("reopen")}
                        </button>
                        <button
                          className="button secondary"
                          disabled={!data || busy}
                          onClick={() => {
                            if (data)
                              download(
                                exportCSV(
                                  data,
                                  files,
                                  assignments,
                                  expiries,
                                  language,
                                ),
                                `${safeFilename(data.tender.tender_id)}_Checklist.csv`,
                                "text/csv;charset=utf-8",
                              );
                          }}
                        >
                          <Icon name="download" size={17} />
                          {t("csv")}
                        </button>
                      </div>
                    </section>
                    <section className="panel tool-card">
                      <h2>{t("suggestions")}</h2>
                      <p>{t("suggestedHelp")}</p>
                      <button
                        className="button secondary"
                        disabled={!data || !files.length || busy}
                        onClick={suggest}
                      >
                        {t("suggest")}
                      </button>
                      <div className="tool-actions">
                        <button
                          className="button secondary"
                          title={t("sampleResolveHelp")}
                          disabled={!data || busy}
                          onClick={resolveSample}
                        >
                          {t("sampleResolve")}
                        </button>
                      </div>
                      <small>{t("sampleResolveHelp")}</small>
                    </section>
                    <section className="panel tool-card">
                      <h2>{t("ai")}</h2>
                      <p>{t("aiHelp")}</p>
                      <label htmlFor="api-key">{t("apiKey")}</label>
                      <input
                        id="api-key"
                        type="password"
                        value={apiKey}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={busy}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <label htmlFor="ai-model">{t("model")}</label>
                      <input
                        id="ai-model"
                        type="text"
                        value={model}
                        disabled={busy}
                        onChange={(e) => setModel(e.target.value)}
                      />
                      <small>{t("aiKeyHelp")}</small>
                      <button
                        className="button primary"
                        disabled={
                          !data || !files.length || !apiKey.trim() || busy
                        }
                        onClick={askAI}
                      >
                        {t("askAi")}
                      </button>
                    </section>
                    <section className="panel tool-card">
                      <h2>{t("settings")}</h2>
                      <label className="option-label">
                        <input
                          type="checkbox"
                          checked={includeIndex}
                          disabled={busy}
                          onChange={(e) => {
                            setIncludeIndex(e.target.checked);
                            setStale(true);
                          }}
                        />
                        {t("index")}
                      </label>
                      <small>{t("indexHelp")}</small>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => {
                          navigate("/package");
                          setPackagePage(1);
                        }}
                      >
                        {t("seal")}
                      </button>
                      <p style={{ marginTop: 18 }}>{t("privateHelp")}</p>
                    </section>
                  </div>
                  <div style={{ marginTop: 22 }}>{suggestionPanel}</div>
                </>
              }
            />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>TenderDesk · AI DevFest 2026</span>
          <span>
            <Icon name="lock" size={13} />
            {t("private")}
          </span>
        </footer>
      </div>
    </div>
  );
}

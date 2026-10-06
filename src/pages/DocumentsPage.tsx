import type { ReactNode } from "react";
import type {
  Language,
  Requirements,
  UploadedPDF,
  Assignments,
  Expiries,
} from "../types";
import type { checklist } from "../core";
import { translate } from "../i18n";
import { Icon } from "../Icon";
import Preview from "../Preview";
import ReadinessCard from "../ReadinessCard";
interface Props {
  data?: Requirements;
  language: Language;
  files: UploadedPDF[];
  rows: ReturnType<typeof checklist>;
  assignments: Assignments;
  expiries: Expiries;
  busy: boolean;
  selected?: string;
  previewPage: number;
  progress: number;
  blockers: ReturnType<typeof checklist>;
  suggestionPanel: ReactNode;
  onOpenRequirements: () => void;
  onOpenUpload: () => void;
  onSuggest: () => void;
  onMatch: (id: string, fileId: string) => void;
  onExpiry: (id: string, date: string) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpload: (files: File[]) => Promise<void>;
  onGenerate: () => void;
  onPreviewPage: (page: number) => void;
}
export default function DocumentsPage({
  data,
  language,
  files,
  rows,
  assignments,
  expiries,
  busy,
  selected,
  previewPage,
  progress,
  blockers,
  suggestionPanel,
  onOpenRequirements,
  onOpenUpload,
  onSuggest,
  onMatch,
  onExpiry,
  onSelect,
  onRemove,
  onUpload,
  onGenerate,
  onPreviewPage,
}: Props) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const selectedFile = files.find((f) => f.id === selected);
  return (
    <div className="workspace-grid">
      <div className="workspace-main">
        {data && (
          <section className="panel document-context" aria-label={t("tender")}>
            <div>
              <span className="mini-label">{data.tender.tender_id}</span>
              <h2>{data.tender.title}</h2>
            </div>
            <dl>
              <div>
                <dt>{t("bidder")}</dt>
                <dd>{data.tender.bidder}</dd>
              </div>
              <div>
                <dt>{t("entity")}</dt>
                <dd>{data.tender.procuring_entity}</dd>
              </div>
              <div>
                <dt>{t("deadline")}</dt>
                <dd>{data.tender.submission_deadline}</dd>
              </div>
            </dl>
          </section>
        )}
        {suggestionPanel}
        <section className="panel checklist-panel">
          <div className="panel-header">
            <div>
              <h2>
                {t("checklist")}{" "}
                <span className="count-badge">
                  {data?.requirements.length || 0}
                </span>
              </h2>
              <p>{t("checklistHelp")}</p>
            </div>
            <button
              className="button secondary"
              disabled={!data || !files.length || busy}
              onClick={onSuggest}
            >
              {t("suggest")}
            </button>
          </div>
          {!data ? (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name="file" size={32} />
              </span>
              <h3>{t("noRequirements")}</h3>
              <p>{t("emptyHelp")}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => onOpenRequirements()}
              >
                {t("import")}
              </button>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("document")}</th>
                    <th>{t("file")}</th>
                    <th>{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ requirement: r, file, status }, i) => (
                    <tr
                      key={r.id}
                      id={`requirement-${r.id}`}
                      tabIndex={-1}
                      data-requirement={r.id}
                    >
                      <td>
                        <div className="document-name">
                          <span className="row-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <strong>
                              {language === "en" ? r.title_en : r.title_bn}
                            </strong>
                            <small>
                              {t(r.mandatory ? "required" : "optional")}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="match-cell">
                        <select
                          disabled={busy}
                          aria-label={`${t("file")}: ${language === "en" ? r.title_en : r.title_bn}`}
                          value={assignments[r.id] || ""}
                          onChange={(e) => onMatch(r.id, e.target.value)}
                        >
                          <option value="">{t("unmatch")}</option>
                          {files.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                        {r.has_expiry && file && (
                          <input
                            className="expiry-input"
                            type="date"
                            title={t("dateHint")}
                            aria-label={`${t("expiry")}: ${language === "en" ? r.title_en : r.title_bn}`}
                            disabled={busy}
                            value={expiries[r.id] || ""}
                            onChange={(e) => {
                              onExpiry(r.id, e.target.value);
                            }}
                          />
                        )}
                      </td>
                      <td>
                        <span className={`status ${status}`}>{t(status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel files-panel">
          <div className="panel-header">
            <div>
              <h2>
                {t("files")} <span className="count-badge">{files.length}</span>
              </h2>
              <p>{t("fileHint")}</p>
            </div>
            <span className="size-label">
              {(files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(1)}{" "}
              / 50 MB
            </span>
          </div>
          {!files.length ? (
            <div className="empty-files">{t("noFiles")}</div>
          ) : (
            <div className="file-list">
              {files.map((f) => (
                <div
                  className={`file-item ${selected === f.id ? "selected" : ""}`}
                  key={f.id}
                >
                  <span className="pdf-icon">
                    <Icon name="file" />
                  </span>
                  <button
                    className="file-title"
                    onClick={() => {
                      onSelect(f.id);
                    }}
                  >
                    <strong>{f.name}</strong>
                    <span>
                      {f.pages} {t("pages")} · {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </button>
                  {Object.values(assignments).includes(f.id) && (
                    <span className="assigned-tag">{t("assigned")}</span>
                  )}
                  {files.filter((x) => x.hash === f.hash).length > 1 && (
                    <span className="duplicate-tag">{t("duplicate")}</span>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`${t("preview")} ${f.name}`}
                    onClick={() => {
                      onSelect(f.id);
                    }}
                  >
                    <Icon name="eye" size={18} />
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={busy}
                    aria-label={`${t("remove")} ${f.name}`}
                    onClick={() => onRemove(f.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="workspace-side">
        <section
          className="panel upload-panel"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void onUpload(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="upload-symbol">
            <Icon name="upload" size={30} />
          </div>
          <h2>{t("uploadTitle")}</h2>
          <p>{t("uploadHelp")}</p>
          <small>{t("limits")}</small>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => onOpenUpload()}
          >
            <Icon name="plus" size={17} />
            {t("browse")}
          </button>
        </section>
        <ReadinessCard
          language={language}
          hasRequirements={Boolean(data)}
          progress={progress}
          blockers={blockers}
          busy={busy}
          onGenerate={onGenerate}
          showBlockers
        />
        <section className="panel small-preview">
          <div className="panel-header">
            <h2>{t("preview")}</h2>
            {selectedFile && (
              <span className="count-badge">
                {selectedFile.pages} {t("pages")}
              </span>
            )}
          </div>
          {selectedFile && <p className="preview-name">{selectedFile.name}</p>}
          <Preview
            bytes={selectedFile?.bytes}
            language={language}
            page={previewPage}
            onPage={onPreviewPage}
          />
        </section>
      </div>
    </div>
  );
}

import { Link } from "react-router";
import type { Language, Requirements } from "../types";
import type { checklist } from "../core";
import { Icon } from "../Icon";
import { translate } from "../i18n";
import type { MessageKey } from "../i18n";
import ReadinessCard from "../ReadinessCard";
interface Props {
  data?: Requirements;
  language: Language;
  ready: number;
  blocking: number;
  totalPages: number;
  progress: number;
  blockers: ReturnType<typeof checklist>;
  fileCount: number;
  busy: boolean;
  hasPackage: boolean;
  onGenerate: () => void;
  onOpenRequirements: () => void;
}
export default function OverviewPage({
  data,
  language,
  ready,
  blocking,
  totalPages,
  progress,
  blockers,
  fileCount,
  busy,
  hasPackage,
  onGenerate,
  onOpenRequirements,
}: Props) {
  const t = (key: MessageKey) => translate(language, key);
  return (
    <div className="overview-page">
      <section className="stats" aria-label={t("overview")}>
        {[
          {
            key: "total",
            value: data?.requirements.length || 0,
            icon: "file",
            color: "blue",
          },
          { key: "ready", value: ready, icon: "check", color: "green" },
          {
            key: "issues",
            value: blocking,
            icon: "alert",
            color: "orange",
          },
          {
            key: "pageCount",
            value: totalPages,
            icon: "package",
            color: "purple",
          },
        ].map((s) => (
          <div className="stat-card" key={s.key}>
            <div>
              <span>{t(s.key as MessageKey)}</span>
              <strong>
                {s.value.toLocaleString(language === "bn" ? "bn-BD" : "en-US")}
              </strong>
            </div>
            <span className={`stat-icon ${s.color}`}>
              <Icon name={s.icon as "file"} />
            </span>
          </div>
        ))}
      </section>
      {data && (
        <section className="tender-card">
          <div className="tender-title">
            <span className="mini-label">{t("tender")}</span>
            <h2>{data.tender.title}</h2>
            <span className="tender-id">{data.tender.tender_id}</span>
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
              <dd className="deadline">{data.tender.submission_deadline}</dd>
            </div>
          </dl>
        </section>
      )}

      <div className="overview-grid">
        <div className="overview-main">
          <section className="panel overview-attention">
            <div className="panel-header">
              <div>
                <h2>{t("attention")}</h2>
                <p>
                  {t(
                    !data
                      ? "importFirst"
                      : blocking
                        ? "overviewAttentionHelp"
                        : "readyHelp",
                  )}
                </p>
              </div>
              <span
                className={`count-badge ${blocking ? "attention-count" : ""}`}
              >
                {blocking}
              </span>
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
                  onClick={onOpenRequirements}
                >
                  {t("import")}
                </button>
              </div>
            ) : blocking ? (
              <ul className="overview-issues">
                {blockers.map(({ requirement: r, status }) => (
                  <li key={r.id}>
                    <Link
                      to={`/documents#requirement-${encodeURIComponent(r.id)}`}
                    >
                      <span>
                        <strong>
                          {language === "bn" ? r.title_bn : r.title_en}
                        </strong>
                        <small>{t(status)}</small>
                      </span>
                      <Icon name="chevron" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="overview-ready">
                <span className="empty-icon">
                  <Icon name="check" size={32} />
                </span>
                <h3>{t("checklistComplete")}</h3>
                <p>{t("readyHelp")}</p>
                <Link className="button secondary" to="/documents">
                  {t("reviewDocuments")}
                </Link>
              </div>
            )}
          </section>
          <section className="panel overview-steps">
            <div className="panel-header">
              <div>
                <h2>{t("nextSteps")}</h2>
                <p>{t("nextStepsHelp")}</p>
              </div>
            </div>
            <ol>
              <li>
                <span className={`step-marker ${data ? "done" : ""}`}>
                  {data ? <Icon name="check" size={18} /> : 1}
                </span>
                <div>
                  <strong>{t("import")}</strong>
                  <p>{t(data ? "requirementsLoaded" : "importFirst")}</p>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={onOpenRequirements}
                >
                  {t(data ? "changeRequirements" : "import")}
                </button>
              </li>
              <li>
                <span className={`step-marker ${fileCount ? "done" : ""}`}>
                  {fileCount ? <Icon name="check" size={18} /> : 2}
                </span>
                <div>
                  <strong>{t("upload")}</strong>
                  <p>
                    {fileCount ? `${fileCount} ${t("files")}` : t("noFiles")}
                  </p>
                </div>
                <Link className="button secondary" to="/documents">
                  {t("manageDocuments")}
                </Link>
              </li>
              <li>
                <span
                  className={`step-marker ${data && !blocking ? "done" : ""}`}
                >
                  {data && !blocking ? <Icon name="check" size={18} /> : 3}
                </span>
                <div>
                  <strong>{t("reviewChecklist")}</strong>
                  <p>{t(data && !blocking ? "readyHelp" : "checklistHelp")}</p>
                </div>
                <Link className="button secondary" to="/documents">
                  {t("reviewDocuments")}
                </Link>
              </li>
            </ol>
          </section>
        </div>
        <div className="overview-side">
          <ReadinessCard
            language={language}
            hasRequirements={Boolean(data)}
            progress={progress}
            blockers={blockers}
            busy={busy}
            onGenerate={onGenerate}
          />
          <section className="panel tool-card">
            <h2>{t("package")}</h2>
            <p>{t("packageHelp")}</p>
            {hasPackage ? (
              <Link className="button secondary wide" to="/package">
                <Icon name="eye" size={17} />
                {t("viewPackage")}
              </Link>
            ) : (
              <small>{t("awaiting")}</small>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

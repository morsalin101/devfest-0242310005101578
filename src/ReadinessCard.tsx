import { Icon } from "./Icon";
import { translate } from "./i18n";
import type { Language } from "./types";
import type { checklist } from "./core";
interface Props {
  language: Language;
  hasRequirements: boolean;
  progress: number;
  blockers: ReturnType<typeof checklist>;
  busy: boolean;
  onGenerate: () => void;
  showBlockers?: boolean;
}
export default function ReadinessCard({
  language,
  hasRequirements,
  progress,
  blockers,
  busy,
  onGenerate: generate,
  showBlockers = false,
}: Props) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const blocking = blockers.length;
  const data = hasRequirements;
  return (
    <section className="panel readiness">
      <div className="readiness-title">
        <h2>{t("progress")}</h2>
        <strong>{progress}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>{t(!data ? "importFirst" : blocking ? "blockers" : "readyHelp")}</p>
      {showBlockers && blocking > 0 && (
        <ul className="blocker-list">
          {blockers.map(({ requirement: r, status }) => (
            <li key={r.id}>
              {language === "en" ? r.title_en : r.title_bn}: {t(status)}
            </li>
          ))}
        </ul>
      )}
      <button
        className="button primary wide"
        disabled={!data || blocking > 0 || busy}
        onClick={generate}
      >
        <Icon name="package" size={18} />
        {t("generate")}
      </button>
    </section>
  );
}

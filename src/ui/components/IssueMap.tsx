import {
  Antenna,
  CircleHelp,
  Megaphone,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";
import type { ResearchIssue, ResearchLanguage } from "../../types";

const ICONS: Array<[RegExp, ComponentType<{ size?: number; strokeWidth?: number }>]> = [
  [/telecom|電訊|電信/i, Antenna],
  [/data|privacy|個人資料|私隱/i, UserRound],
  [/consumer|消費者/i, ShieldCheck],
  [/competition|競爭/i, Scale],
  [/marketing|促銷|推廣/i, Megaphone],
];

function IssueIcon({ issue }: { issue: ResearchIssue }) {
  const Icon = ICONS.find(([pattern]) => pattern.test(`${issue.id} ${issue.label}`))?.[1] ?? CircleHelp;
  return <Icon aria-hidden="true" size={28} strokeWidth={1.55} />;
}

export function IssueMap({
  issues,
  loading,
  language,
}: {
  issues: ResearchIssue[];
  loading: boolean;
  language: ResearchLanguage;
}) {
  return (
    <aside className="issue-panel">
      <div className="section-title">
        <span aria-hidden="true" />
        <h1>{language === "zh-Hant" ? "研究範圍" : "Research scope"}</h1>
      </div>
      <p className="issue-intro">
        {language === "zh-Hant" ? "按議題瀏覽相關法例領域" : "Browse legislation by legal issue"}
      </p>
      <div className="issue-list">
        {loading && !issues.length ? (
          <div className="issue-loading">
            <span className="spinner" aria-hidden="true" />
            {language === "zh-Hant" ? "正在展開法律議題…" : "Mapping legal issues…"}
          </div>
        ) : null}
        {issues.map((issue, index) => (
          <div className={`issue-row${index === 0 ? " selected" : ""}`} key={issue.id}>
            <IssueIcon issue={issue} />
            <div>
              <strong>{issue.label}</strong>
              <span>{language === "zh-Hant" ? "已檢索現行法例" : "Current law searched"}</span>
            </div>
            <ShieldCheck className="issue-status complete" aria-label="Search complete" size={20} />
          </div>
        ))}
      </div>
      <p className="issue-note">
        {language === "zh-Hant" ? "研究結果按官方條文與版本資料產生。如有不確定，請取得專業法律意見。" : "Results are grounded in official provisions and version metadata. Seek professional advice where uncertain."}
      </p>
    </aside>
  );
}

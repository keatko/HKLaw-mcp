import { ExternalLink } from "lucide-react";
import type { Applicability, ResearchCitation, ResearchFinding, ResearchLanguage } from "../../types";
import { ProvisionRow } from "./ProvisionRow";

export function FindingSection({
  classification,
  title,
  description,
  findings,
  citations,
  language,
}: {
  classification: Applicability;
  title: string;
  description: string;
  findings: ResearchFinding[];
  citations: Map<number, ResearchCitation>;
  language: ResearchLanguage;
}) {
  const sectionCitations = [...new Set(findings.flatMap((finding) => finding.citationIds))]
    .map((id) => citations.get(id))
    .filter((item): item is ResearchCitation => Boolean(item));
  return (
    <section className={`finding-section ${classification}`}>
      <div className="finding-heading">
        <div>
          <span aria-hidden="true" />
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {sectionCitations[0] ? (
          <a href={sectionCitations[0].officialUrl} target="_blank" rel="noreferrer">
            {language === "zh-Hant" ? "查看香港電子法例原文" : "View official HKeL text"}
            <ExternalLink aria-hidden="true" size={15} />
          </a>
        ) : null}
      </div>
      <div className="finding-explanations">
        {findings.map((finding) => (
          <p key={`${finding.issueId}-${finding.heading}`}><strong>{finding.heading}</strong>{finding.explanation}</p>
        ))}
      </div>
      <div className="provision-table" role="table" aria-label={title}>
        <div className="provision-header" role="row">
          <span role="columnheader">{language === "zh-Hant" ? "法例" : "Ordinance"}</span>
          <span role="columnheader">{language === "zh-Hant" ? "章節" : "Cap."}</span>
          <span role="columnheader">{language === "zh-Hant" ? "條文" : "Provision"}</span>
          <span role="columnheader">{language === "zh-Hant" ? "條文內容" : "Provision text"}</span>
          <span role="columnheader">{language === "zh-Hant" ? "版本日期" : "Version"}</span>
          <span role="columnheader">{language === "zh-Hant" ? "官方來源" : "Source"}</span>
        </div>
        {sectionCitations.map((item) => <ProvisionRow key={item.provisionId} citation={item} language={language} />)}
      </div>
    </section>
  );
}

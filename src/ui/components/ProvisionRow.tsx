import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { ResearchCitation, ResearchLanguage } from "../../types";

export function ProvisionRow({ citation, language }: { citation: ResearchCitation; language: ResearchLanguage }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`provision-row${expanded ? " expanded" : ""}`} role="row">
      <button type="button" className="provision-name" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <ChevronDown aria-hidden="true" size={17} />
        <span>{citation.title}</span>
      </button>
      <span role="cell">{citation.capDisplay || `Cap. ${citation.capNo}`}</span>
      <span role="cell">{citation.provisionRef}</span>
      <span className="provision-excerpt" role="cell">
        {citation.heading ? <strong>{citation.heading}</strong> : null}
        {expanded ? citation.bodyText : `${citation.bodyText.slice(0, 165)}${citation.bodyText.length > 165 ? "…" : ""}`}
      </span>
      <time role="cell" dateTime={citation.versionDate}>{citation.versionDate.slice(0, 10)}</time>
      <a role="cell" href={citation.officialUrl} target="_blank" rel="noreferrer">
        {language === "zh-Hant" ? "查看原文" : "Official text"}
        <ExternalLink aria-hidden="true" size={15} />
      </a>
    </div>
  );
}

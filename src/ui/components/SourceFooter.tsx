import { forwardRef } from "react";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import type { ResearchLanguage, ResearchResponse } from "../../types";

export const SourceFooter = forwardRef<HTMLElement, { result: ResearchResponse; language: ResearchLanguage }>(
  function SourceFooter({ result, language }, ref) {
    return (
      <section className="source-footer" ref={ref}>
        <div>
          <ShieldCheck aria-hidden="true" size={22} />
          <div>
            <h2>{language === "zh-Hant" ? "資料來源核實" : "Source verification"}</h2>
            <p>{language === "zh-Hant" ? "條文來自香港特別行政區政府香港電子法例的現行 XML 資料，下載時已核對官方 SHA-256。" : "Provisions come from current Hong Kong e-Legislation XML published by the HKSAR Government and were verified against official SHA-256 values."}</p>
            <p>{language === "zh-Hant" ? `索引：${result.sources.indexedAt.slice(0, 10)} · 清單：${result.sources.manifestUpdatedAt.slice(0, 10)} · 模型：${result.sources.model}` : `Indexed: ${result.sources.indexedAt.slice(0, 10)} · Manifest: ${result.sources.manifestUpdatedAt.slice(0, 10)} · Model: ${result.sources.model}`}</p>
            <a href="https://www.elegislation.gov.hk/" target="_blank" rel="noreferrer">
              www.elegislation.gov.hk
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          </div>
        </div>
        <div>
          <AlertTriangle aria-hidden="true" size={22} />
          <div>
            <h2>{language === "zh-Hant" ? "研究用途，並非法律意見" : "Research assistance, not legal advice"}</h2>
            <p>{result.disclaimer}</p>
          </div>
        </div>
      </section>
    );
  },
);

import { useMemo, useRef, useState } from "react";
import { Database, ExternalLink } from "lucide-react";
import type { Applicability, ResearchLanguage, ResearchResponse } from "../types";
import { FindingSection } from "./components/FindingSection";
import { IssueMap } from "./components/IssueMap";
import { QuestionComposer } from "./components/QuestionComposer";
import { SourceFooter } from "./components/SourceFooter";

const EXAMPLES: Record<ResearchLanguage, string> = {
  "zh-Hant": "在香港向消費者提供電訊服務並處理客戶資料，需要遵守哪些法例？",
  en: "Which Hong Kong laws may apply if I provide telecommunications services to consumers and process customer data?",
};

const LABELS: Record<ResearchLanguage, Record<string, string>> = {
  "zh-Hant": {
    sources: "資料來源",
    direct: "直接適用",
    directDescription: "按已提供事實，最直接相關的現行條文。",
    conditional: "視情況適用",
    conditionalDescription: "取決於服務模式、牌照身分或實際做法。",
    needsFacts: "需要進一步確認",
    needsFactsDescription: "需要補充事實後才能評估的法律範圍。",
    noFindings: "未找到可核實的條文引用。請補充業務模式或改用較具體的問題。",
    cases: "相關判例研究",
  },
  en: {
    sources: "Sources",
    direct: "Directly relevant",
    directDescription: "Current provisions most directly connected to the supplied facts.",
    conditional: "Conditionally relevant",
    conditionalDescription: "Depends on the service model, licensing status, or actual conduct.",
    needsFacts: "More facts required",
    needsFactsDescription: "Legal areas that require further facts before they can be assessed.",
    noFindings: "No verifiable provision citations were found. Add details about the business model or ask a narrower question.",
    cases: "Related case research",
  },
};

const CLASSIFICATIONS: Applicability[] = ["direct", "conditional", "needs-facts"];

function classificationCopy(classification: Applicability, labels: Record<string, string>) {
  if (classification === "direct") {
    return { title: labels.direct, description: labels.directDescription };
  }
  if (classification === "conditional") {
    return { title: labels.conditional, description: labels.conditionalDescription };
  }
  return { title: labels.needsFacts, description: labels.needsFactsDescription };
}

export function App() {
  const [language, setLanguage] = useState<ResearchLanguage>("zh-Hant");
  const [question, setQuestion] = useState(EXAMPLES["zh-Hant"]);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sourceRef = useRef<HTMLElement>(null);
  const labels = LABELS[language];

  const citations = useMemo(
    () => new Map(result?.citations.map((item) => [item.provisionId, item]) ?? []),
    [result],
  );

  async function submit() {
    if (question.trim().length < 8 || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: question.trim(), language }),
      });
      const payload = (await response.json()) as ResearchResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error || "Research request failed" : "Research request failed");
      }
      setResult(payload as ResearchResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Research request failed");
    } finally {
      setLoading(false);
    }
  }

  function changeLanguage(next: ResearchLanguage) {
    setLanguage(next);
    if (!result) setQuestion(EXAMPLES[next]);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand" aria-label="香港法律研究 HK Legal Research">
          <strong>香港法律研究</strong>
          <span>HK Legal Research</span>
        </div>
        <nav className="header-actions" aria-label="Utility navigation">
          <label className="language-control">
            <span className="sr-only">Language</span>
            <select value={language} onChange={(event) => changeLanguage(event.target.value as ResearchLanguage)}>
              <option value="zh-Hant">繁體中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <button className="source-jump" type="button" onClick={() => sourceRef.current?.scrollIntoView({ behavior: "smooth" })}>
            {labels.sources}
            <ExternalLink aria-hidden="true" size={17} />
          </button>
        </nav>
      </header>

      <main className="research-layout">
        <IssueMap issues={result?.issues ?? []} loading={loading} language={language} />
        <section className="research-main">
          <QuestionComposer
            language={language}
            question={question}
            loading={loading}
            onQuestionChange={setQuestion}
            onSubmit={submit}
          />

          {error ? <div className="error-banner" role="alert">{error}</div> : null}

          {result ? (
            <div className="answer" aria-live="polite">
              <p className="answer-summary">{result.summary}</p>
              {CLASSIFICATIONS.map((classification) => {
                const findings = result.findings.filter((item) => item.classification === classification);
                if (!findings.length) return null;
                const { title, description } = classificationCopy(classification, labels);
                return (
                  <FindingSection
                    key={classification}
                    classification={classification}
                    title={title}
                    description={description}
                    findings={findings}
                    citations={citations}
                    language={language}
                  />
                );
              })}

              {!result.findings.length ? <p className="empty-answer">{labels.noFindings}</p> : null}

              {result.missingFacts.length ? (
                <section className="missing-facts">
                  <h2>{language === "zh-Hant" ? "需要補充的資料" : "Facts to clarify"}</h2>
                  <ul>{result.missingFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                </section>
              ) : null}

              <section className="judiciary-research">
                <div>
                  <Database aria-hidden="true" size={20} />
                  <div>
                    <h2>{labels.cases}</h2>
                    <p>{result.judiciary.note}</p>
                    <p className="keyword-line">{result.judiciary.keywords.join(" · ")}</p>
                  </div>
                </div>
                <a href={result.judiciary.searchUrl} target="_blank" rel="noreferrer">
                  {language === "zh-Hant" ? "開啟官方判詞搜尋" : "Open official judgment search"}
                  <ExternalLink aria-hidden="true" size={16} />
                </a>
              </section>

              <SourceFooter ref={sourceRef} result={result} language={language} />
            </div>
          ) : (
            <div className="intro-state">
              <p>{language === "zh-Hant" ? "系統會先拆解法律議題，再逐項檢索所有現行主體及附屬法例。" : "The system maps distinct legal issues before searching all current principal and subsidiary legislation."}</p>
              <p>{language === "zh-Hant" ? "請勿輸入未公開案情、身分證明資料或其他機密資料。" : "Do not submit confidential facts, identity documents, or other non-public information."}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

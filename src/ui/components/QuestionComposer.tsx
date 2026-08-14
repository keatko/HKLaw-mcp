import { Search, X } from "lucide-react";
import type { ResearchLanguage } from "../../types";

export function QuestionComposer({
  language,
  question,
  loading,
  onQuestionChange,
  onSubmit,
}: {
  language: ResearchLanguage;
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="composer-section">
      <div className="section-title">
        <span aria-hidden="true" />
        <h1>{language === "zh-Hant" ? "提出法律研究問題" : "Ask a legal research question"}</h1>
      </div>
      <div className="composer">
        <textarea
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSubmit();
          }}
          aria-label={language === "zh-Hant" ? "法律研究問題" : "Legal research question"}
          placeholder={language === "zh-Hant" ? "說明事實、業務模式及你想了解的法律問題…" : "Describe the facts, business model, and legal question…"}
          rows={3}
        />
        {question ? (
          <button className="clear-question" type="button" onClick={() => onQuestionChange("")} aria-label="Clear question">
            <X aria-hidden="true" size={19} />
          </button>
        ) : null}
      </div>
      <div className="composer-actions">
        <span>{language === "zh-Hant" ? "⌘／Ctrl + Enter 送出" : "⌘/Ctrl + Enter to submit"}</span>
        <button type="button" onClick={onSubmit} disabled={loading || question.trim().length < 8}>
          {loading ? <span className="spinner light" aria-hidden="true" /> : <Search aria-hidden="true" size={19} />}
          {loading ? (language === "zh-Hant" ? "研究中…" : "Researching…") : (language === "zh-Hant" ? "提出問題" : "Ask question")}
        </button>
      </div>
    </section>
  );
}

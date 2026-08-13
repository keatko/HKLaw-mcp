export interface Env {}

export type HkLanguage = "en" | "zh-Hant" | "zh-Hans";

export type ResearchLanguage = "en" | "zh-Hant";
export type Applicability = "direct" | "conditional" | "needs-facts";

export interface ResearchIssue {
  id: string;
  label: string;
  scope: string;
  queries: string[];
}

export interface ResearchIssueMap {
  language: ResearchLanguage;
  issues: ResearchIssue[];
  privacyRisk: "low" | "medium" | "high";
  modelUsed: boolean;
}

export interface ResearchCitation {
  provisionId: number;
  capNo: string;
  capDisplay: string;
  title: string;
  provisionRef: string;
  heading: string | null;
  bodyText: string;
  versionDate: string;
  officialUrl: string;
  sourceFile: string;
  sourceSha256: string;
}

export interface ResearchFinding {
  classification: Applicability;
  issueId: string;
  heading: string;
  explanation: string;
  citationIds: number[];
}

export interface ResearchResponse {
  question: string;
  language: ResearchLanguage;
  summary: string;
  issues: ResearchIssue[];
  findings: ResearchFinding[];
  citations: ResearchCitation[];
  missingFacts: string[];
  judiciary: {
    keywords: string[];
    searchUrl: string;
    note: string;
  };
  sources: {
    indexedAt: string;
    manifestUpdatedAt: string;
    languages: ResearchLanguage[];
    model: string;
  };
  disclaimer: string;
}

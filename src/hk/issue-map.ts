import { z } from "zod";
import type { ResearchIssue, ResearchIssueMap, ResearchLanguage } from "../types";
import { generateStructured } from "./opencode";

const issueSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  label: z.string().min(2).max(50),
  scope: z.string().min(3).max(180),
  queries: z.array(z.string().min(3).max(100)).min(1).max(4),
});

const issueMapSchema = z.object({
  privacyRisk: z.enum(["low", "medium", "high"]),
  issues: z.array(issueSchema).min(1).max(8),
});

const FALLBACK_ISSUES: Array<{
  id: string;
  zhLabel: string;
  enLabel: string;
  pattern: RegExp;
  zhQueries: string[];
  enQueries: string[];
}> = [
  {
    id: "telecom-licensing",
    zhLabel: "電訊牌照",
    enLabel: "Telecom licensing",
    pattern: /電訊|電信|telecom|communications service|internet service/i,
    zhQueries: ["禁止設置 維持電訊設施", "公共電訊服務 持牌人"],
    enQueries: ["telecommunications service licence", "public telecommunications service licensee"],
  },
  {
    id: "personal-data",
    zhLabel: "個人資料",
    enLabel: "Personal data",
    pattern: /個人資料|私隱|客戶資料|personal data|privacy|customer data/i,
    zhQueries: ["個人資料 收集 使用", "資料使用者 保安"],
    enQueries: ["personal data collection use", "data user security"],
  },
  {
    id: "consumer-protection",
    zhLabel: "消費者保障",
    enLabel: "Consumer protection",
    pattern: /消費者|客戶|收費|服務條款|consumer|customer|fee|service terms/i,
    zhQueries: ["商品說明條例 不良營商手法", "誤導性遺漏"],
    enQueries: ["consumer service representation", "unfair trade practice"],
  },
  {
    id: "competition",
    zhLabel: "競爭",
    enLabel: "Competition",
    pattern: /競爭|市場|定價|competition|market|pricing/i,
    zhQueries: ["反競爭行為", "競爭條例 合謀"],
    enQueries: ["competition market conduct", "agreement price fixing"],
  },
  {
    id: "direct-marketing",
    zhLabel: "直接促銷",
    enLabel: "Direct marketing",
    pattern: /推廣|促銷|短訊|電郵|marketing|promotional|message|email/i,
    zhQueries: ["直接促銷 個人資料", "商業電子訊息 同意"],
    enQueries: ["direct marketing personal data", "commercial electronic message consent"],
  },
  {
    id: "cybersecurity",
    zhLabel: "網絡安全",
    enLabel: "Cybersecurity",
    pattern: /網絡|系統|保安|事故|cyber|system|security|incident/i,
    zhQueries: ["電腦系統 保安 措施", "關鍵基礎設施 電腦系統"],
    enQueries: ["computer system security measures", "critical infrastructure computer system"],
  },
];

export function detectResearchLanguage(question: string): ResearchLanguage {
  const han = question.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return han >= 2 ? "zh-Hant" : "en";
}

export function fallbackIssueMap(question: string, language: ResearchLanguage): ResearchIssueMap {
  const matches = FALLBACK_ISSUES.filter((issue) => issue.pattern.test(question));
  const matchIds = new Set(matches.map((issue) => issue.id));
  const isTelecomDataScenario = matchIds.has("telecom-licensing") && matchIds.has("personal-data");
  let selected = matches;
  if (isTelecomDataScenario) selected = FALLBACK_ISSUES;
  else if (!matches.length) selected = FALLBACK_ISSUES.slice(0, 3);
  const issues = selected.map<ResearchIssue>((issue) => ({
    id: issue.id,
    label: language === "zh-Hant" ? issue.zhLabel : issue.enLabel,
    scope:
      language === "zh-Hant"
        ? `檢查與${issue.zhLabel}相關的現行香港主體及附屬法例。`
        : `Check current principal and subsidiary Hong Kong legislation concerning ${issue.enLabel.toLocaleLowerCase()}.`,
    queries: language === "zh-Hant" ? issue.zhQueries : issue.enQueries,
  }));
  return {
    language,
    issues,
    privacyRisk: /個人資料|客戶資料|私隱|身分|personal data|customer data|privacy|identity/i.test(question)
      ? "high"
      : "medium",
    modelUsed: false,
  };
}

export async function expandIssueMap(
  question: string,
  language = detectResearchLanguage(question),
): Promise<ResearchIssueMap> {
  const fallback = fallbackIssueMap(question, language);
  const generated = await generateStructured(
    {
      name: "hong_kong_legal_issue_map",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          privacyRisk: { type: "string", enum: ["low", "medium", "high"] },
          issues: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", pattern: "^[a-z][a-z0-9-]{1,30}$" },
                label: { type: "string", minLength: 2, maxLength: 50 },
                scope: { type: "string", minLength: 3, maxLength: 180 },
                queries: {
                  type: "array",
                  minItems: 1,
                  maxItems: 4,
                  items: { type: "string", minLength: 3, maxLength: 100 },
                },
              },
              required: ["id", "label", "scope", "queries"],
            },
          },
        },
        required: ["privacyRisk", "issues"],
      },
    },
    `You are planning source retrieval for Hong Kong legal research. Expand the user's facts into distinct legal issues that could lead to different principal or subsidiary legislation. Include adjacent compliance domains when factually triggered, such as licensing, personal data, consumer protection, competition, direct marketing, cybersecurity, sector codes, and record keeping. Produce narrow bilingual-search-ready queries in ${language === "zh-Hant" ? "Traditional Chinese" : "English"}. Do not give legal conclusions or invent ordinance names.\n\nQuestion: ${question}`,
  );
  if (!generated) return fallback;
  const parsed = issueMapSchema.safeParse(generated);
  if (!parsed.success) return fallback;
  return { language, ...parsed.data, modelUsed: true };
}

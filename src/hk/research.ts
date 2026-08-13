import { z } from "zod";
import type {
  Applicability,
  ResearchCitation,
  ResearchFinding,
  ResearchLanguage,
  ResearchResponse,
} from "../types";
import type { ProvisionSearchResult } from "../../scripts/lib/hkel-index";
import { expandIssueMap } from "./issue-map";
import { judiciaryDiscovery } from "./judiciary";
import { generateStructured, isOpenCodeConfigured, OPEN_CODE_MODEL } from "./opencode";
import { openHkelIndex } from "./search";

const findingSchema = z.object({
  classification: z.enum(["direct", "conditional", "needs-facts"]),
  issueId: z.string().min(2).max(40),
  heading: z.string().min(2).max(120),
  explanation: z.string().min(4).max(700),
  citationIds: z.array(z.number().int().positive()).min(1).max(6),
});

const synthesisSchema = z.object({
  summary: z.string().min(8).max(1200),
  findings: z.array(findingSchema).max(24),
  missingFacts: z.array(z.string().min(3).max(220)).max(10),
  judgmentKeywords: z.array(z.string().min(2).max(80)).max(8),
});

function citation(result: ProvisionSearchResult): ResearchCitation {
  return {
    provisionId: result.id,
    capNo: result.capNo,
    capDisplay: result.capDisplay,
    title: result.title,
    provisionRef: result.provisionRef,
    heading: result.heading,
    bodyText: result.bodyText,
    versionDate: result.versionDate,
    officialUrl: result.officialUrl,
    sourceFile: result.sourceFile,
    sourceSha256: result.sourceSha256,
  };
}

function collectCandidates(
  issues: Awaited<ReturnType<typeof expandIssueMap>>["issues"],
  language: ResearchLanguage,
): Array<ProvisionSearchResult & { issueIds: string[] }> {
  const index = openHkelIndex();
  const candidates = new Map<number, ProvisionSearchResult & { issueIds: string[] }>();
  for (const issue of issues) {
    for (const query of issue.queries) {
      const results = index.search({ query, language, limit: 8 });
      for (const result of results) {
        const current = candidates.get(result.id);
        if (current) {
          if (!current.issueIds.includes(issue.id)) current.issueIds.push(issue.id);
        } else {
          candidates.set(result.id, { ...result, issueIds: [issue.id] });
        }
      }
    }
  }
  const ranked = [...candidates.values()].sort(
    (a, b) => a.score - b.score || a.capNo.localeCompare(b.capNo),
  );
  const selected = new Map<number, ProvisionSearchResult & { issueIds: string[] }>();
  for (const issue of issues) {
    const topForIssue = ranked.find((candidate) => candidate.issueIds.includes(issue.id));
    if (topForIssue) selected.set(topForIssue.id, topForIssue);
  }
  for (const candidate of ranked) {
    if (selected.size >= 36) break;
    selected.set(candidate.id, candidate);
  }
  return [...selected.values()].sort(
    (a, b) => a.score - b.score || a.capNo.localeCompare(b.capNo),
  );
}

function fallbackSynthesis(
  language: ResearchLanguage,
  issues: Awaited<ReturnType<typeof expandIssueMap>>["issues"],
  candidates: Array<ProvisionSearchResult & { issueIds: string[] }>,
): z.infer<typeof synthesisSchema> {
  const findings: ResearchFinding[] = [];
  const usedCaps = new Set<string>();
  for (const issue of issues) {
    const matching = candidates.filter((candidate) => candidate.issueIds.includes(issue.id));
    const candidate = matching.find((item) => !usedCaps.has(item.capNo)) ?? matching[0];
    if (!candidate) continue;
    usedCaps.add(candidate.capNo);
    findings.push({
      classification: "needs-facts",
      issueId: issue.id,
      heading: candidate.heading || candidate.title,
      explanation:
        language === "zh-Hant"
          ? "官方條文索引顯示此條文可能相關；在確定業務模式、牌照身分及資料流程後才能判斷是否適用。"
          : "The official provision index indicates a possible connection. Applicability depends on the business model, licensing status, and data flow.",
      citationIds: [candidate.id],
    });
  }
  return {
    summary:
      language === "zh-Hant"
        ? "已按不同法律議題搜尋現行香港法例。以下結果是待核實的研究線索，並非適用性結論。"
        : "Current Hong Kong legislation was searched across distinct legal issues. The results below are research leads, not conclusions on applicability.",
    findings,
    missingFacts: [],
    judgmentKeywords: [],
  };
}

async function synthesize(
  question: string,
  language: ResearchLanguage,
  issues: Awaited<ReturnType<typeof expandIssueMap>>["issues"],
  candidates: Array<ProvisionSearchResult & { issueIds: string[] }>,
): Promise<z.infer<typeof synthesisSchema>> {
  const context = candidates.map((candidate) => ({
    id: candidate.id,
    issueIds: candidate.issueIds,
    capNo: candidate.capNo,
    title: candidate.title,
    provisionRef: candidate.provisionRef,
    heading: candidate.heading,
    text: candidate.bodyText.slice(0, 2200),
    versionDate: candidate.versionDate,
  }));
  const generated = await generateStructured(
    {
      name: "hong_kong_legal_research_answer",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string", minLength: 8, maxLength: 1200 },
          findings: {
            type: "array",
            maxItems: 24,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                classification: {
                  type: "string",
                  enum: ["direct", "conditional", "needs-facts"],
                },
                issueId: { type: "string", minLength: 2, maxLength: 40 },
                heading: { type: "string", minLength: 2, maxLength: 120 },
                explanation: { type: "string", minLength: 4, maxLength: 700 },
                citationIds: {
                  type: "array",
                  minItems: 1,
                  maxItems: 6,
                  items: { type: "integer", minimum: 1 },
                },
              },
              required: ["classification", "issueId", "heading", "explanation", "citationIds"],
            },
          },
          missingFacts: {
            type: "array",
            maxItems: 10,
            items: { type: "string", minLength: 3, maxLength: 220 },
          },
          judgmentKeywords: {
            type: "array",
            maxItems: 8,
            items: { type: "string", minLength: 2, maxLength: 80 },
          },
        },
        required: ["summary", "findings", "missingFacts", "judgmentKeywords"],
      },
    },
    `You are a Hong Kong legal research synthesizer. Use only the supplied official HKeL provision candidates. Do not cite an ID that is absent. Distinguish direct applicability, conditional applicability, and questions needing more facts. Explain why each provision may matter without giving legal advice. Mention gaps instead of filling them from memory. Write in ${language === "zh-Hant" ? "Traditional Chinese" : "English"}.\n\nUser question:\n${question}\n\nIssue map:\n${JSON.stringify(issues)}\n\nOfficial provision candidates:\n${JSON.stringify(context)}`,
  );
  if (!generated) return fallbackSynthesis(language, issues, candidates);
  const parsed = synthesisSchema.safeParse(generated);
  if (!parsed.success) return fallbackSynthesis(language, issues, candidates);
  return parsed.data;
}

function validateFindings(
  findings: ResearchFinding[],
  candidates: Array<ProvisionSearchResult & { issueIds: string[] }>,
): ResearchFinding[] {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  return findings.flatMap((finding) => {
    const citationIds = [...new Set(finding.citationIds)].filter((id) => candidateIds.has(id));
    return citationIds.length ? [{ ...finding, citationIds }] : [];
  });
}

function latest(values: string[]): string {
  return [...values].sort().at(-1) ?? "unknown";
}

export async function researchHongKongLaw(
  question: string,
  requestedLanguage?: ResearchLanguage,
): Promise<ResearchResponse> {
  const issueMap = await expandIssueMap(question, requestedLanguage);
  const candidates = collectCandidates(issueMap.issues, issueMap.language);
  const synthesis = await synthesize(question, issueMap.language, issueMap.issues, candidates);
  const findings = validateFindings(synthesis.findings, candidates);
  const usedIds = new Set(findings.flatMap((finding) => finding.citationIds));
  const citations = candidates.filter((candidate) => usedIds.has(candidate.id)).map(citation);
  const status = openHkelIndex().sourceStatus();
  const issueKeywords = issueMap.issues.flatMap((issue) => issue.queries.slice(0, 1));
  return {
    question,
    language: issueMap.language,
    summary: synthesis.summary,
    issues: issueMap.issues,
    findings,
    citations,
    missingFacts: synthesis.missingFacts,
    judiciary: judiciaryDiscovery(
      synthesis.judgmentKeywords.length ? synthesis.judgmentKeywords : issueKeywords,
      issueMap.language,
    ),
    sources: {
      indexedAt: latest(status.map((item) => item.syncedAt)),
      manifestUpdatedAt: latest(status.map((item) => item.updatedAt)),
      languages: status.map((item) => item.language),
      model: isOpenCodeConfigured() ? OPEN_CODE_MODEL : "deterministic-fallback",
    },
    disclaimer:
      issueMap.language === "zh-Hant"
        ? "研究用途，並非法律意見。重要事項請核對香港電子法例的核證文本，並諮詢合資格的香港法律專業人士。"
        : "Research assistance only, not legal advice. Verify important matters against the verified HKeL text and consult a qualified Hong Kong legal professional.",
  };
}

export const researchRequestSchema = z.object({
  question: z.string().trim().min(8).max(6000),
  language: z.enum(["en", "zh-Hant"]).optional(),
});

export function applicabilityOrder(value: Applicability): number {
  return value === "direct" ? 0 : value === "conditional" ? 1 : 2;
}

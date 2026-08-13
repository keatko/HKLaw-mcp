// Benign Hong Kong legal-research MCP tools backed only by public HKeL manifests.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Env, HkLanguage } from "../types";
import {
  chapterTitle,
  currentVersion,
  fetchCurrentManifest,
  getCurrentManifestUrl,
} from "./manifest";

const languageSchema = z.enum(["en", "zh-Hant", "zh-Hans"]);

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function capMatches(capNo: string, query: string): boolean {
  const normalized = query.replace(/^cap\.?\s*/i, "").trim().toLocaleLowerCase();
  return capNo.toLocaleLowerCase() === normalized;
}

function safeLimit(value: number | undefined, fallback = 10): number {
  return Math.max(1, Math.min(value ?? fallback, 25));
}

function sourceLanguageNote(language: HkLanguage): string | undefined {
  if (language === "zh-Hans") {
    return "HKeL states that its Simplified Chinese version is generated from Traditional Chinese and is for information only; Traditional Chinese prevails if there is inconsistency or ambiguity.";
  }
  return undefined;
}

export function registerHongKongTools(server: McpServer, _env: Env): void {
  server.registerTool(
    "analyze_legal_intent",
    {
      description:
        "Classify a Hong Kong legal research request before retrieval. Identifies likely research areas, source needs, and high-stakes cautions. Does not give a legal conclusion.",
      inputSchema: {
        query: z.string().min(3).max(8000).describe("The user's legal research question or fact pattern."),
      },
    },
    async ({ query }) => {
      const q = query.toLocaleLowerCase();
      const areas = [
        ["privacy/data", /privacy|personal data|pdpo|data breach|私隱|個人資料/],
        ["employment", /employment|employee|dismiss|wage|labour|僱傭|僱員|工資|解僱/],
        ["companies", /company|director|shareholder|companies ordinance|公司|董事|股東/],
        ["contract", /contract|indemn|liabil|termination|agreement|合約|彌償|責任|終止/],
        ["criminal", /criminal|offence|arrest|sentence|刑事|罪行|拘捕|判刑/],
      ] as const;

      const detected = areas.filter(([, pattern]) => pattern.test(q)).map(([name]) => name);
      return json({
        jurisdiction: "Hong Kong SAR",
        detected_research_areas: detected.length ? detected : ["general"],
        recommended_sequence: ["search_hk_laws", "get_hk_law"],
        source_policy: "Prefer official HKeL data and official URLs; treat machine-readable/HTML text as research reference.",
        legal_status_note:
          "On HKeL, verified PDF copies bearing the official verification mark have legal status; HTML/other formats are reference material.",
        caution:
          "Research assistance only. Verify the cited source and version date before relying on a result.",
      });
    },
  );

  server.registerTool(
    "search_hk_laws",
    {
      description:
        "Search the official current Hong Kong e-Legislation (HKeL) manifest by chapter number or title. Returns official HKeL URLs, status, and version metadata.",
      inputSchema: {
        query: z.string().min(1).max(300).describe("Title words, common law name, or chapter number such as '622' or 'Companies Ordinance'."),
        language: languageSchema.optional().describe("HKeL language; defaults to English."),
        include_not_in_effect: z.boolean().optional().describe("Include repealed/no-longer-in-effect items. Defaults to false."),
        limit: z.number().int().min(1).max(25).optional(),
      },
    },
    async ({ query, language = "en", include_not_in_effect = false, limit }) => {
      const manifest = await fetchCurrentManifest(language as HkLanguage);
      const q = normalizeQuery(query);
      const results = manifest.Chapter
        .map((chapter) => ({ chapter, version: currentVersion(chapter) }))
        .filter(({ chapter, version }) => {
          if (!version) return false;
          if (!include_not_in_effect && version.VersionDate.statusCategory !== "InEffect") return false;
          const title = normalizeQuery(chapterTitle(chapter));
          return capMatches(chapter.CapNo, query) || title.includes(q);
        })
        .slice(0, safeLimit(limit))
        .map(({ chapter, version }) => ({
          cap_no: chapter.CapNo,
          cap_display: chapter.CapNoDisplay,
          title: chapterTitle(chapter),
          legislation_type: chapter.LegislationType,
          principal_ordinance: chapter.PrincipalOrdinance,
          version_date: version?.VersionDate.value,
          status: version?.VersionDate.statusCategory,
          pencil_marked: version?.VersionDate.isPencilMarked,
          official_url: version?.Web,
          source_file: version?.FileName,
        }));

      return json({
        source: "Hong Kong Department of Justice — Hong Kong e-Legislation (HKeL)",
        manifest_url: getCurrentManifestUrl(language as HkLanguage),
        manifest_updated_at: manifest.UpdatedDateTime,
        language,
        source_language_note: sourceLanguageNote(language as HkLanguage),
        results,
      });
    },
  );

  server.registerTool(
    "get_hk_law",
    {
      description:
        "Get official current metadata for a Hong Kong law by chapter number, including version date, status, machine-readable source package, and official HKeL link.",
      inputSchema: {
        cap_no: z.string().min(1).max(20).describe("Chapter number, e.g. '486', '622', or subsidiary legislation such as '1A'."),
        language: languageSchema.optional(),
      },
    },
    async ({ cap_no, language = "en" }) => {
      const manifest = await fetchCurrentManifest(language as HkLanguage);
      const chapter = manifest.Chapter.find((item) => capMatches(item.CapNo, cap_no));
      if (!chapter) return json({ found: false, cap_no, language });
      const version = currentVersion(chapter);
      const dataResource = manifest.DataSet
        .map((item) => item.DataResource)
        .find((resource) => resource.url === version?.DataResourceUrl);

      return json({
        found: true,
        cap_no: chapter.CapNo,
        title: chapterTitle(chapter),
        language,
        source_language_note: sourceLanguageNote(language as HkLanguage),
        legislation_type: chapter.LegislationType,
        principal_ordinance: chapter.PrincipalOrdinance,
        version_date: version?.VersionDate.value,
        status: version?.VersionDate.statusCategory,
        status_code: version?.VersionDate.statusCode,
        pencil_marked: version?.VersionDate.isPencilMarked,
        official_url: version?.Web,
        machine_readable_source: {
          zip_url: version?.DataResourceUrl,
          file_location: version?.FileLocation,
          file_name: version?.FileName,
          source_zip_sha256: dataResource?.sha256,
          source_zip_date: dataResource?.fileDate,
        },
        manifest_updated_at: manifest.UpdatedDateTime,
        legal_status_note:
          "Use the official HKeL page to obtain the verified PDF when legal-status verification is required.",
      });
    },
  );

  server.registerTool(
    "get_hk_source_status",
    {
      description:
        "Report current official HKeL manifest timestamps for English and Traditional Chinese sources.",
      inputSchema: {},
    },
    async () => {
      const [en, zhHant] = await Promise.all([
        fetchCurrentManifest("en"),
        fetchCurrentManifest("zh-Hant"),
      ]);
      return json({
        jurisdiction: "Hong Kong SAR",
        official_current_manifests: {
          en: { updated_at: en.UpdatedDateTime, url: getCurrentManifestUrl("en") },
          "zh-Hant": { updated_at: zhHant.UpdatedDateTime, url: getCurrentManifestUrl("zh-Hant") },
        },
      });
    },
  );
}

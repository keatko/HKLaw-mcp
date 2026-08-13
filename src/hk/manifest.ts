// Benign legal-research source adapter. Fetches only public Hong Kong e-Legislation manifests.
import type { HkLanguage } from "../types";

const CURRENT_MANIFEST_URLS: Record<HkLanguage, string> = {
  en: "https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_en.json",
  "zh-Hant": "https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_zh-Hant.json",
  "zh-Hans": "https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_zh-Hans.json",
};

export interface HkelDataResource {
  orderNo: number;
  url: string;
  LegislationType: string;
  capNoStart: string;
  capNoEnd: string;
  fileDate: string;
  fileSize: number;
  sha256: string;
  value: string;
}

export interface HkelVersion {
  VersionDate: {
    isCurrentVersion: boolean;
    isPencilMarked: boolean;
    statusCategory: string;
    statusCode: string;
    value: string;
  };
  DataResourceUrl: string;
  FileLocation: string;
  FileName: string;
  Web: string;
}

export interface HkelChapter {
  CapNo: string;
  CapNoDisplay: string;
  ChapterTitleEnglish?: string;
  ChapterTitleChinese?: string;
  ChapterTitle?: string;
  LegislationType: string;
  PrincipalOrdinance: string;
  Version: HkelVersion[];
}

export interface HkelManifest {
  UpdatedDateTime: string;
  lang: HkLanguage;
  pointOfTime: string;
  legislationType: string;
  DataSet: Array<{ DataResource: HkelDataResource }>;
  Chapter: HkelChapter[];
}

export function getCurrentManifestUrl(language: HkLanguage): string {
  return CURRENT_MANIFEST_URLS[language];
}

export async function fetchCurrentManifest(language: HkLanguage): Promise<HkelManifest> {
  const url = getCurrentManifestUrl(language);
  const response = await fetch(url, {
    headers: { "User-Agent": "hong-kong-law-mcp/0.1 (+official-source-research)" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!response.ok) {
    throw new Error(`HKeL manifest request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as HkelManifest;
}

export function chapterTitle(chapter: HkelChapter): string {
  return (
    chapter.ChapterTitleEnglish ??
    chapter.ChapterTitleChinese ??
    chapter.ChapterTitle ??
    chapter.CapNoDisplay
  );
}

export function currentVersion(chapter: HkelChapter): HkelVersion | undefined {
  return chapter.Version.find((version) => version.VersionDate.isCurrentVersion) ?? chapter.Version[0];
}

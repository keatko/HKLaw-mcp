import { HkelIndex, type IndexedLanguage, type ProvisionSearchResult } from "../../scripts/lib/hkel-index";

let shared: { path: string; index: HkelIndex } | undefined;

export function openHkelIndex(path = process.env.HKLAW_DB_PATH ?? "data/hklaw.db"): HkelIndex {
  if (shared?.path === path) return shared.index;
  shared?.index.close();
  shared = { path, index: new HkelIndex(path) };
  return shared.index;
}

export function searchProvisions(
  query: string,
  language: IndexedLanguage,
  limit = 12,
  capNo?: string,
): ProvisionSearchResult[] {
  return openHkelIndex().search({ query, language, limit, capNo });
}

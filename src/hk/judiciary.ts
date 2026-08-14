import type { ResearchLanguage } from "../types";

const JUDICIARY_SEARCH_URL =
  "https://legalref.judiciary.hk/lrs/common/index.jsp?target=judgment&lan=en";

export function judiciaryDiscovery(keywords: string[], language: ResearchLanguage) {
  return {
    keywords: [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))].slice(0, 8),
    searchUrl: JUDICIARY_SEARCH_URL,
    note:
      language === "zh-Hant"
        ? "香港司法機構未提供公開判詞 API；請在官方法律參考資料系統使用以上關鍵詞搜尋並核讀判詞全文。"
        : "The Hong Kong Judiciary does not expose a public judgments API. Use these terms in the official Legal Reference System and read the full judgment before relying on it.",
  };
}

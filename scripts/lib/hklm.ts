// Benign parser for public Hong Kong legislation XML; no security or credential functionality.
export interface ExtractedProvision {
  provisionRef: string;
  heading: string | null;
  bodyText: string;
  orderIndex: number;
}

const PROVISION_KEYS = new Set([
  "section",
  "clause",
  "article",
  "rule",
  "regulation",
  "bylaw",
  "paragraph",
  "schedule",
]);

const CONTENT_KEYS = ["content", "leadIn", "paragraph", "subparagraph", "def", "proviso", "formula"];

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.entries(object)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, child]) => text(child))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function firstText(node: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const candidate = text(node[key]).replace(/\s+/g, " ").trim();
    if (candidate) return candidate;
  }
  return "";
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function provisionBody(node: Record<string, unknown>): string {
  const selected = CONTENT_KEYS.flatMap((key) => asArray(node[key])).map(text).filter(Boolean);
  return clean(selected.length ? selected.join(" ") : text(node));
}

export function extractProvisions(document: unknown): ExtractedProvision[] {
  const out: ExtractedProvision[] = [];
  let orderIndex = 0;

  function visit(value: unknown, keyName = ""): void {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, keyName));
      return;
    }
    if (!value || typeof value !== "object") return;

    const node = value as Record<string, unknown>;
    const localKey = keyName.toLocaleLowerCase();

    if (PROVISION_KEYS.has(localKey)) {
      const provisionRef = clean(
        firstText(node, ["num", "no", "number", "label", "sectionNum", "clauseNum"]) ||
          String(node["@_name"] ?? node["@_id"] ?? node["@_xml:id"] ?? `${keyName} ${orderIndex + 1}`),
      );
      const heading = clean(
        firstText(node, ["heading", "title", "marginalNote", "crossHeading", "caption"]),
      );
      const bodyText = provisionBody(node);

      if (bodyText.length >= 8) {
        out.push({
          provisionRef,
          heading: heading || null,
          bodyText,
          orderIndex: orderIndex++,
        });
      }
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith("@_")) visit(child, key);
    }
  }

  visit(document);

  if (out.length === 0) {
    const bodyText = clean(text(document));
    if (bodyText) {
      out.push({ provisionRef: "full-text", heading: null, bodyText, orderIndex: 0 });
    }
  }

  return out;
}

export function valueArray<T>(value: T | T[] | undefined | null): T[] {
  return asArray(value);
}

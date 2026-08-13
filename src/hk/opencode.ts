export const OPEN_CODE_BASE_URL = "https://opencode.ai/zen/v1";
const OPEN_CODE_ENDPOINT = `${OPEN_CODE_BASE_URL}/chat/completions`;
export const OPEN_CODE_MODEL = "big-pickle";

interface JsonSchemaRequest {
  name: string;
  schema: Record<string, unknown>;
}

function apiKey(): string | undefined {
  return process.env.open_code ?? process.env.OPEN_CODE_API_KEY;
}

export function isOpenCodeConfigured(): boolean {
  return Boolean(apiKey());
}

function outputText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.choices)) return undefined;
  const first = root.choices[0];
  if (!first || typeof first !== "object") return undefined;
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return undefined;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : undefined;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced?.[1] ?? trimmed) as unknown;
}

export async function generateStructured(
  format: JsonSchemaRequest,
  input: string,
): Promise<unknown | null> {
  const key = apiKey();
  if (!key) return null;
  const response = await fetch(OPEN_CODE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: OPEN_CODE_MODEL,
      messages: [
        {
          role: "system",
          content: `Return only valid JSON matching the JSON Schema named ${format.name}. Do not use markdown fences or add commentary. JSON Schema: ${JSON.stringify(format.schema)}`,
        },
        { role: "user", content: input },
      ],
      temperature: 0,
    }),
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    throw new Error(`OpenCode request failed (${response.status})${requestId ? ` [${requestId}]` : ""}`);
  }
  const text = outputText(await response.json());
  if (!text) throw new Error("OpenCode returned no structured output");
  return parseJson(text);
}

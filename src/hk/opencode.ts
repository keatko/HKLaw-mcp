const OPEN_CODE_ENDPOINT = "https://opencode.ai/zen/v1/responses";
export const OPEN_CODE_MODEL = "gpt-5.6-sol";

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
  if (typeof root.output_text === "string") return root.output_text;
  if (!Array.isArray(root.output)) return undefined;
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string") return text;
    }
  }
  return undefined;
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
      input,
      reasoning: { effort: "medium" },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: format.name,
          strict: true,
          schema: format.schema,
        },
      },
    }),
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    throw new Error(`OpenCode request failed (${response.status})${requestId ? ` [${requestId}]` : ""}`);
  }
  const text = outputText(await response.json());
  if (!text) throw new Error("OpenCode returned no structured output");
  return JSON.parse(text) as unknown;
}

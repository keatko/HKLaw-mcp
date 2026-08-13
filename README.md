# Hong Kong Legal Research

A bilingual, text-only Hong Kong legal-research service grounded in the current official Hong Kong e-Legislation (HKeL) corpus. It combines a provision-level search index, a constrained OpenCode research workflow, a React interface, and the original stateless MCP metadata tools.

## What it does

For a fact pattern such as providing telecommunications services while processing customer data, the research workflow:

1. expands the facts into distinct legal issues;
2. runs a separate full-text search for every issue;
3. merges and deduplicates the official provision candidates;
4. sorts the candidates before constrained answer synthesis;
5. rejects every model citation that is not present in the retrieved candidate set.

The response groups findings as directly relevant, conditionally relevant, or requiring more facts. Every cited provision includes official clause text, chapter and section references, the source version date, an HKeL URL, source filename, and package SHA-256 provenance.

## Sources and scope

- Current English and Traditional Chinese principal and subsidiary legislation from the eight official HKeL XML packages.
- HKeL manifests are checked on every synchronization and every downloaded package is verified against the published SHA-256 digest.
- Simplified Chinese is not indexed as authoritative text.
- The Hong Kong Judiciary does not provide a public judgments API. The interface generates case-research keywords and links to the official Legal Reference System; it does not claim to have searched or indexed judgments.

Machine-readable XML and HTML are used for research retrieval. Verify important matters against the verified copy available through HKeL. The service is for legal research only and is not legal advice.

## Architecture

- `scripts/sync-hkel.ts` downloads, verifies, parses, and atomically installs the bilingual legislation index.
- `scripts/lib/hkel-index.ts` provides the immutable provision records, FTS5 trigram index, and source-status metadata.
- `src/hk/issue-map.ts` performs bounded issue expansion with a deterministic cross-domain fallback.
- `src/hk/research.ts` implements expand → search → merge → sort → grounded synthesis.
- `site-server.ts` exposes health, source status, provision search, and research APIs and serves the React application.
- `src/index.ts` retains the Cloudflare-compatible, stateless HKeL metadata MCP endpoint.

The model never supplies statutory text. It can propose search terms and explain retrieved candidates, but citations survive only when their local provision IDs resolve to official indexed records.

## OpenCode configuration

The server reads the OpenCode Zen credential from `open_code`, with `OPEN_CODE_API_KEY` supported as a compatibility alias. The configured endpoint and model are:

- base URL: `https://opencode.ai/zen/go/v1`
- endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- model: the `OPEN_CODE_MODEL` environment variable, defaulting to `grok-4.5`

Keep the secret server-side. Never expose it through Vite variables or browser code. Without a configured secret, the service uses deterministic issue mapping and a clearly labelled fallback synthesis.

To switch models without changing code, update `OPEN_CODE_MODEL` in the Zo service environment and restart the service. The value must be a model ID returned by the OpenCode Zen Go `/models` endpoint.

## Synchronize the official index

```bash
bun install --frozen-lockfile
bun run sync:hkel
```

Downloaded packages are cached under `.cache/hkel/`. The completed index is installed at `data/hklaw.db` only after both languages finish successfully.

To rebuild from already verified cached packages:

```bash
bun run sync:hkel --skip-download
```

## Run and validate

```bash
bun run dev
bun run check
```

The development server uses port `54872`. Production uses port `54873` and the production build from `dist/`.

Useful read-only checks:

```bash
curl -s http://127.0.0.1:54872/api/health
curl -sG http://127.0.0.1:54872/api/provisions/search \
  --data-urlencode 'q=個人資料 保安' \
  --data-urlencode 'language=zh-Hant'
```

## HTTP API

- `GET /api/health` — service and bilingual source status.
- `GET /api/sources` — manifest timestamps and indexed counts.
- `GET /api/provisions/search?q=...&language=en|zh-Hant` — official provision retrieval.
- `POST /api/research` — comprehensive issue expansion and grounded synthesis.

Example request:

```json
{
  "question": "在香港向消費者提供電訊服務並處理客戶資料，需要遵守哪些法例？",
  "language": "zh-Hant"
}
```

## Zo delivery

`zosite.json` defines a private-first Zo Site. The private preview must be validated before any public deployment. The index and downloaded source packages remain local generated data and are excluded from Git.

## Existing metadata MCP tools

The stateless Worker MCP continues to expose:

- `analyze_legal_intent`
- `search_hk_laws`
- `get_hk_law`
- `get_hk_source_status`

These tools query official manifest metadata. The Zo research application is the provision-level search and Q&A implementation.

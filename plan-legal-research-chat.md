# Confirmed decisions

- The generated desktop visual concept was approved on 2026-08-13.

# Checklist

## Phase 1 — Complete HKeL provision index

- ☑ Add verified bilingual package synchronization and provision-level SQLite indexing.
- ☑ Extend HKLM parsing and test principal and subsidiary legislation structures.
- ☑ Add deterministic provision search with bilingual ranking and source provenance.

## Phase 2 — Grounded research service

- ☑ Add OpenCode issue expansion and constrained answer synthesis.
- ☑ Add citation validation, research classifications, and Judiciary discovery links.
- ☑ Expose validated health, source-status, search, and research APIs.

## Phase 3 — Zo research interface and delivery

- ☑ Build the approved bilingual React interface and responsive states.
- ☑ Add production Zo Site configuration and desktop/mobile end-to-end checks.
- ☐ Push the feature branch, open a draft PR, and deploy an owner-only preview.

# Phase 1 — Complete HKeL provision index

## Affected files

- `package.json`, `tsconfig.json`, `.gitignore`: add indexer/runtime dependencies, scripts, types, and generated-data exclusions.
- `scripts/sync-hkel.ts`: download all current English and Traditional Chinese HKeL packages, verify manifest checksums, and atomically replace the index.
- `scripts/lib/hklm.ts`: extract stable provision hierarchy and normalized searchable text from official HKLM XML.
- `scripts/lib/hkel-index.ts`: define the SQLite schema, source metadata, indexing transaction, and search functions.
- `src/hk/search.ts`: expose typed provision queries and result ranking to MCP and web APIs.
- `tests/hklm.test.ts`, `tests/hkel-index.test.ts`: cover principal sections, subsidiary provisions, bilingual text, stable references, checksum failure, source metadata, and cross-ordinance retrieval.

Create one immutable provision value per language and official version. Keep download, parsing, persistence, and querying independent so each can be replaced without changing the others. Search all principal and subsidiary legislation, rank title/heading matches above body-only matches, and preserve enough provenance to reconstruct every citation.

# Phase 2 — Grounded research service

## Affected files

- `src/types.ts`: define issue-map, provision-result, citation, classification, and research-response contracts.
- `src/hk/issue-map.ts`: validate bounded OpenCode query expansion and supply a deterministic fallback issue map.
- `src/hk/opencode.ts`: call the OpenCode Zen Responses API with server-only credentials and strict structured output.
- `src/hk/research.ts`: orchestrate parallel issue searches, deduplication, context limits, synthesis, and citation verification.
- `src/hk/judiciary.ts`: construct official Judiciary Legal Reference System discovery URLs without copying judgment content.
- `site-server.ts`: expose health, source-status, provision-search, and comprehensive research endpoints with request validation and safe errors; retain the existing stateless metadata MCP separately.
- `tests/issue-map.test.ts`, `tests/research.test.ts`, `tests/judiciary.test.ts`: cover cross-domain expansion, malformed model output, unsupported citations, duplicate provisions, source grouping, and safe official URLs.

The model proposes issue categories and queries but never supplies legal text. Only local official-source results enter synthesis. Reject any final citation that does not resolve to the candidate set, classify relevance as direct, conditional, or needs-facts, and return explicit source freshness and model-use metadata.

# Phase 3 — Zo research interface and delivery

## Affected files

- `index.html`, `vite.config.ts`, `zosite.json`: add the React/Vite build and private-first Zo runtime.
- `src/ui/main.tsx`, `src/ui/App.tsx`: compose the bilingual research screen and request lifecycle.
- `src/ui/components/*`: implement the issue map, question composer, grouped findings, provision rows, source verification, and error/empty states.
- `src/ui/styles.css`: implement the approved editorial design tokens, responsive layout, focus states, and reduced-motion behavior.
- Browser verification: exercise the core telecommunications-and-customer-data flow at desktop and mobile viewports against the completed official index.
- `README.md`: document synchronization, local operation, source policy, OpenCode secret name, validation, and Zo deployment.

Keep the browser as a pure renderer of typed API responses. Use focused components and stable data boundaries, preserve all source and classification details on mobile, and make external official links visibly distinct. Build, typecheck, unit-test, and browser-test before pushing a draft PR and creating the owner-only Zo preview.

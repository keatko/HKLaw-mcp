# Hong Kong Law MCP

A stateless Model Context Protocol server for Hong Kong legal research, backed by official Hong Kong e-Legislation (HKeL) open-data manifests.

This is the Hong Kong foundation for a planned multi-jurisdiction service covering **Hong Kong, Singapore, and Malaysia**.

## Current tools

The v0.1 core exposes four tools:

- `analyze_legal_intent` — classifies a Hong Kong legal-research request and highlights source/high-stakes cautions without giving a legal conclusion.
- `search_hk_laws` — searches the official current HKeL manifest by chapter number or title.
- `get_hk_law` — returns current chapter metadata, status, version date, official HKeL URL, and machine-readable source provenance.
- `get_hk_source_status` — reports current official HKeL manifest timestamps for English and Traditional Chinese.

## Source policy

Primary source: Hong Kong Department of Justice, **Hong Kong e-Legislation (HKeL)**.

Current manifests:

- English: `https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_en.json`
- Traditional Chinese: `https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_zh-Hant.json`
- Simplified Chinese: `https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_zh-Hans.json`

Tool responses preserve official HKeL URLs, current version dates, status information, source filenames, and available SHA-256 provenance.

### Legal-status distinction

Machine-readable data and HTML are used for research and retrieval. Where legal-status verification matters, use the official HKeL page and verified PDF copy carrying the official verification mark.

### Simplified Chinese

HKeL states that its Simplified Chinese text is software-converted from Traditional Chinese and is for information only. If there is inconsistency or ambiguity, Traditional Chinese prevails. The MCP surfaces this warning whenever `zh-Hans` is requested.

## Architecture

The current core is deliberately stateless: MCP clients call a Streamable HTTP endpoint, and the Worker retrieves current metadata from official HKeL manifests. Full-text provision indexing and point-in-time legislation can be added as separate persistence adapters without changing the public jurisdiction interface.

## Local validation

Install dependencies and run:

```bash
npm run typecheck
npm test
```

Cloudflare/Wrangler deployment configuration is intentionally kept separate from this initial application-code PR.

## Roadmap

### HK v0.2

- Add full-text provision search/read from official HKeL machine-readable packages.
- Add point-in-time legislation and past-version retrieval.
- Add judgment search/read using authoritative Judiciary sources.
- Add amendment and legislative-history tools.
- Add citation and version-fidelity evals.
- Add production rate limiting and authentication where appropriate.

### Singapore and Malaysia

Keep one public MCP interface with jurisdiction-specific adapters while preserving each jurisdiction's authoritative-source, commencement, versioning, citation, and court-hierarchy semantics.

## Disclaimer

Research assistance only; not legal advice. Verify source text, version date, commencement/status, and any verified-copy requirements before relying on a result.

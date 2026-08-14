# Hong Kong Legal Research Chat Design

## Product boundary

Build a private-first Zo web application for bilingual Hong Kong legal research. Users enter a factual or compliance question in text. The application expands the question into distinct legal issues, searches official Hong Kong legislation at provision level, and synthesizes a source-grounded research answer. It is research assistance, not legal advice.

The first release indexes every current principal ordinance and item of subsidiary legislation published by Hong Kong e-Legislation in English and Traditional Chinese. Simplified Chinese is not an authoritative retrieval language. Judgment discovery uses the Hong Kong Judiciary Legal Reference System without maintaining a local judgment corpus.

## Retrieval architecture

The weekly indexer downloads the official HKeL current-version XML packages, verifies each package against the manifest SHA-256 value, parses the HKLM hierarchy, and writes immutable source metadata plus normalized provisions to SQLite. The searchable record preserves language, chapter, title, provision reference, heading, body text, version date, status, pencil-mark status, source package, source checksum, and official HKeL URL.

Research uses a fixed four-stage pipeline:

1. OpenCode expands a user question into a bounded issue map and bilingual search queries.
2. Each issue is searched independently against the local provision index.
3. Candidate provisions are deduplicated and reranked with source and applicability metadata intact.
4. OpenCode writes a structured answer using only supplied candidates, separating directly applicable, conditionally applicable, and fact-dependent matters.

Every cited proposition must point to a retrieved official provision. Unsupported model claims are rejected before the response is returned.

## Interface and deployment

The primary screen uses an open two-column research layout: an issue map on the left and the question, grouped findings, provision rows, source verification, and disclaimer on the right. It supports Traditional Chinese and English and contains no voice, uploads, projects, credits, or inert product controls.

The application runs as a Bun/Hono Zo Site. The server owns the SQLite connection and OpenCode credential; the browser never receives the credential. Initial publication is owner-only. Automated checks cover parsing, source verification, issue expansion validation, provision search, citation grounding, API validation, and production build. The owner validates the private URL with the telecommunications-and-customer-data scenario before any public deployment.

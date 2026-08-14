import { Database } from "bun:sqlite";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import type { ExtractedProvision } from "./hklm";

export type IndexedLanguage = "en" | "zh-Hant";

export interface IndexedDocument {
  language: IndexedLanguage;
  capNo: string;
  capDisplay: string;
  title: string;
  legislationType: string;
  principalOrdinance: string;
  versionDate: string;
  status: string;
  pencilMarked: boolean;
  officialUrl: string;
  sourceFile: string;
  sourceZipUrl: string;
  sourceSha256: string;
}

export interface SourceStatusRecord {
  language: IndexedLanguage;
  manifestUrl: string;
  updatedAt: string;
  syncedAt: string;
  documentCount: number;
  provisionCount: number;
}

export interface ProvisionSearchResult {
  id: number;
  language: IndexedLanguage;
  capNo: string;
  capDisplay: string;
  title: string;
  provisionRef: string;
  heading: string | null;
  bodyText: string;
  versionDate: string;
  officialUrl: string;
  sourceFile: string;
  sourceSha256: string;
  score: number;
}

export interface ProvisionSearchOptions {
  query: string;
  language?: IndexedLanguage;
  limit?: number;
  capNo?: string;
}

const SCHEMA = `
  CREATE TABLE source_status (
    language TEXT PRIMARY KEY,
    manifest_url TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    document_count INTEGER NOT NULL,
    provision_count INTEGER NOT NULL
  );
  CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    language TEXT NOT NULL,
    cap_no TEXT NOT NULL,
    cap_display TEXT NOT NULL,
    title TEXT NOT NULL,
    legislation_type TEXT NOT NULL,
    principal_ordinance TEXT NOT NULL,
    version_date TEXT NOT NULL,
    status TEXT NOT NULL,
    pencil_marked INTEGER NOT NULL,
    official_url TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_zip_url TEXT NOT NULL,
    source_sha256 TEXT NOT NULL,
    UNIQUE(language, cap_no)
  );
  CREATE TABLE provisions (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    language TEXT NOT NULL,
    cap_no TEXT NOT NULL,
    cap_display TEXT NOT NULL,
    title TEXT NOT NULL,
    provision_ref TEXT NOT NULL,
    heading TEXT,
    body_text TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    version_date TEXT NOT NULL,
    official_url TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_sha256 TEXT NOT NULL,
    UNIQUE(document_id, order_index)
  );
  CREATE INDEX provisions_document_id ON provisions(document_id);
  CREATE INDEX provisions_cap_language ON provisions(cap_no, language);
  CREATE VIRTUAL TABLE provisions_fts USING fts5(
    title,
    heading,
    body_text,
    content='provisions',
    content_rowid='id',
    tokenize='trigram'
  );
`;

function boundedLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(limit ?? 12, 50));
}

function normalizeCapNo(value: string): string {
  return value.replace(/^cap\.?\s*/i, "").trim().toLocaleUpperCase();
}

function ftsExpression(query: string): string {
  const tokens = query
    .normalize("NFKC")
    .replace(/["'`*:^(){}\[\]<>~!?,.;/\\|+=_-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => [...token].length >= 3)
    .slice(0, 12);
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"`).join(" OR ");
}

export class HkelIndexBuilder {
  readonly db: Database;
  private readonly insertDocument;
  private readonly insertProvision;
  private readonly upsertSourceStatus;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA journal_mode = OFF");
    this.db.run("PRAGMA synchronous = OFF");
    this.db.run("PRAGMA temp_store = MEMORY");
    this.db.exec(SCHEMA);
    this.insertDocument = this.db.prepare(`
      INSERT INTO documents (
        language, cap_no, cap_display, title, legislation_type, principal_ordinance,
        version_date, status, pencil_marked, official_url, source_file, source_zip_url,
        source_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertProvision = this.db.prepare(`
      INSERT INTO provisions (
        document_id, language, cap_no, cap_display, title, provision_ref, heading,
        body_text, order_index, version_date, official_url, source_file, source_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.upsertSourceStatus = this.db.prepare(`
      INSERT INTO source_status (
        language, manifest_url, updated_at, synced_at, document_count, provision_count
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
  }

  addDocument(document: IndexedDocument, provisions: ExtractedProvision[]): number {
    const result = this.insertDocument.run(
      document.language,
      document.capNo,
      document.capDisplay,
      document.title,
      document.legislationType,
      document.principalOrdinance,
      document.versionDate,
      document.status,
      document.pencilMarked ? 1 : 0,
      document.officialUrl,
      document.sourceFile,
      document.sourceZipUrl,
      document.sourceSha256,
    );
    const documentId = Number(result.lastInsertRowid);
    const insertAll = this.db.transaction((rows: ExtractedProvision[]) => {
      for (const provision of rows) {
        this.insertProvision.run(
          documentId,
          document.language,
          document.capNo,
          document.capDisplay,
          document.title,
          provision.provisionRef,
          provision.heading,
          provision.bodyText,
          provision.orderIndex,
          document.versionDate,
          document.officialUrl,
          document.sourceFile,
          document.sourceSha256,
        );
      }
    });
    insertAll(provisions);
    return provisions.length;
  }

  addSourceStatus(status: SourceStatusRecord): void {
    this.upsertSourceStatus.run(
      status.language,
      status.manifestUrl,
      status.updatedAt,
      status.syncedAt,
      status.documentCount,
      status.provisionCount,
    );
  }

  finish(): void {
    this.db.run("INSERT INTO provisions_fts(provisions_fts) VALUES('rebuild')");
    this.db.run("PRAGMA optimize");
    this.db.close();
  }
}

export function atomicallyReplaceIndex(tempPath: string, destinationPath: string): void {
  rmSync(destinationPath, { force: true });
  renameSync(tempPath, destinationPath);
}

export class HkelIndex {
  readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { readonly: true, strict: true });
  }

  close(): void {
    this.db.close();
  }

  sourceStatus(): SourceStatusRecord[] {
    return this.db
      .query("SELECT language, manifest_url, updated_at, synced_at, document_count, provision_count FROM source_status ORDER BY language")
      .all()
      .map((row) => {
        const value = row as Record<string, string | number>;
        return {
          language: value.language as IndexedLanguage,
          manifestUrl: String(value.manifest_url),
          updatedAt: String(value.updated_at),
          syncedAt: String(value.synced_at),
          documentCount: Number(value.document_count),
          provisionCount: Number(value.provision_count),
        };
      });
  }

  search(options: ProvisionSearchOptions): ProvisionSearchResult[] {
    const match = ftsExpression(options.query);
    if (!match) return [];
    const conditions = ["provisions_fts MATCH ?"];
    const values: Array<string | number> = [match];
    if (options.language) {
      conditions.push("p.language = ?");
      values.push(options.language);
    }
    if (options.capNo) {
      conditions.push("UPPER(p.cap_no) = ?");
      values.push(normalizeCapNo(options.capNo));
    }
    values.push(boundedLimit(options.limit));
    const rows = this.db
      .query(`
        SELECT p.id, p.language, p.cap_no, p.cap_display, p.title, p.provision_ref,
          p.heading, p.body_text, p.version_date, p.official_url, p.source_file,
          p.source_sha256, bm25(provisions_fts, 10.0, 5.0, 1.0) AS score
        FROM provisions_fts
        JOIN provisions p ON p.id = provisions_fts.rowid
        WHERE ${conditions.join(" AND ")}
        ORDER BY score, p.cap_no, p.order_index
        LIMIT ?
      `)
      .all(...values);
    return rows.map((row) => {
      const value = row as Record<string, string | number | null>;
      return {
        id: Number(value.id),
        language: value.language as IndexedLanguage,
        capNo: String(value.cap_no),
        capDisplay: String(value.cap_display),
        title: String(value.title),
        provisionRef: String(value.provision_ref),
        heading: value.heading == null ? null : String(value.heading),
        bodyText: String(value.body_text),
        versionDate: String(value.version_date),
        officialUrl: String(value.official_url),
        sourceFile: String(value.source_file),
        sourceSha256: String(value.source_sha256),
        score: Number(value.score),
      };
    });
  }
}

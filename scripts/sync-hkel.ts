import { XMLParser } from "fast-xml-parser";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { chapterTitle, currentVersion, type HkelManifest } from "../src/hk/manifest";
import { extractProvisions } from "./lib/hklm";
import {
  atomicallyReplaceIndex,
  HkelIndexBuilder,
  type IndexedDocument,
  type IndexedLanguage,
} from "./lib/hkel-index";

const MANIFEST_URLS: Record<IndexedLanguage, string> = {
  en: "https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_en.json",
  "zh-Hant": "https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_zh-Hant.json",
};

interface SyncOptions {
  dbPath: string;
  cacheDir: string;
  skipDownload: boolean;
}

function optionsFromArgs(args: string[]): SyncOptions {
  const value = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? resolve(args[index + 1]!) : resolve(fallback);
  };
  return {
    dbPath: value("--db", "data/hklaw.db"),
    cacheDir: value("--cache", ".cache/hkel"),
    skipDownload: args.includes("--skip-download"),
  };
}

async function fetchManifest(language: IndexedLanguage, cacheDir: string): Promise<HkelManifest> {
  const response = await fetch(MANIFEST_URLS[language], { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Manifest ${language} failed: ${response.status}`);
  const manifest = (await response.json()) as HkelManifest;
  await Bun.write(join(cacheDir, `manifest-${language}.json`), JSON.stringify(manifest));
  return manifest;
}

async function download(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${url}`);
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(destination));
}

async function sha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  const reader = Bun.file(path).stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hasher.update(value);
  }
  return hasher.digest("hex");
}

async function ensurePackages(
  manifests: Record<IndexedLanguage, HkelManifest>,
  packageDir: string,
  skipDownload: boolean,
): Promise<Map<string, string>> {
  mkdirSync(packageDir, { recursive: true });
  const resources = Object.values(manifests).flatMap((manifest) =>
    manifest.DataSet.map((entry) => entry.DataResource),
  );
  const paths = new Map<string, string>();
  for (const resource of resources) {
    const path = join(packageDir, basename(resource.url));
    if (!existsSync(path)) {
      if (skipDownload) throw new Error(`Missing package while --skip-download is set: ${path}`);
      await download(resource.url, `${path}.part`);
      await Bun.write(path, Bun.file(`${path}.part`));
      rmSync(`${path}.part`, { force: true });
    }
    const actual = await sha256(path);
    if (actual.toLocaleLowerCase() !== resource.sha256.toLocaleLowerCase()) {
      throw new Error(`Checksum mismatch for ${basename(path)}`);
    }
    paths.set(resource.url, path);
  }
  return paths;
}

async function extractPackages(packagePaths: Map<string, string>, extractDir: string): Promise<void> {
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  for (const path of packagePaths.values()) {
    const destination = join(extractDir, basename(path, ".zip"));
    mkdirSync(destination, { recursive: true });
    const process = Bun.spawn(["unzip", "-q", "-o", path, "-d", destination], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await process.exited;
    if (exitCode > 1) throw new Error(`unzip failed (${exitCode}): ${basename(path)}`);
  }
}

function packageExtractDir(extractDir: string, zipUrl: string): string {
  return join(extractDir, basename(zipUrl, ".zip"));
}

function extractedXmlPath(extractDir: string, zipUrl: string, location: string, fileName: string): string {
  const root = packageExtractDir(extractDir, zipUrl);
  const candidates = [
    join(root, location, fileName),
    join(root, location.replace(/^cap_/, ""), fileName.replace(/^cap_/, "")),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing extracted XML: ${candidates.join(" or ")}`);
  return found;
}

async function indexManifest(
  builder: HkelIndexBuilder,
  manifest: HkelManifest,
  extractDir: string,
  resources: Map<string, { sha256: string }>,
): Promise<{ documents: number; provisions: number }> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
  });
  let documents = 0;
  let provisions = 0;
  for (const chapter of manifest.Chapter) {
    const version = currentVersion(chapter);
    if (!version || version.VersionDate.statusCategory !== "InEffect") continue;
    const xmlPath = extractedXmlPath(
      extractDir,
      version.DataResourceUrl,
      version.FileLocation,
      version.FileName,
    );
    const parsed = parser.parse(await Bun.file(xmlPath).text());
    const rows = extractProvisions(parsed);
    const resource = resources.get(version.DataResourceUrl);
    if (!resource) throw new Error(`Missing resource metadata: ${version.DataResourceUrl}`);
    const document: IndexedDocument = {
      language: manifest.lang as IndexedLanguage,
      capNo: chapter.CapNo,
      capDisplay: chapter.CapNoDisplay,
      title: chapterTitle(chapter),
      legislationType: chapter.LegislationType,
      principalOrdinance: chapter.PrincipalOrdinance,
      versionDate: version.VersionDate.value,
      status: version.VersionDate.statusCategory,
      pencilMarked: version.VersionDate.isPencilMarked,
      officialUrl: version.Web,
      sourceFile: version.FileName,
      sourceZipUrl: version.DataResourceUrl,
      sourceSha256: resource.sha256,
    };
    provisions += builder.addDocument(document, rows);
    documents += 1;
    if (documents % 250 === 0) console.log(`${manifest.lang}: ${documents} documents`);
  }
  return { documents, provisions };
}

async function main(): Promise<void> {
  const options = optionsFromArgs(process.argv.slice(2));
  mkdirSync(options.cacheDir, { recursive: true });
  const manifests = {
    en: await fetchManifest("en", options.cacheDir),
    "zh-Hant": await fetchManifest("zh-Hant", options.cacheDir),
  };
  const packagePaths = await ensurePackages(
    manifests,
    join(options.cacheDir, "packages"),
    options.skipDownload,
  );
  const extractDir = join(options.cacheDir, "extracted");
  await extractPackages(packagePaths, extractDir);
  const tempDb = `${options.dbPath}.next`;
  rmSync(tempDb, { force: true });
  const builder = new HkelIndexBuilder(tempDb);
  const syncedAt = new Date().toISOString();
  for (const language of ["en", "zh-Hant"] as const) {
    const manifest = manifests[language];
    const resources = new Map(
      manifest.DataSet.map((entry) => [entry.DataResource.url, entry.DataResource]),
    );
    const counts = await indexManifest(builder, manifest, extractDir, resources);
    builder.addSourceStatus({
      language,
      manifestUrl: MANIFEST_URLS[language],
      updatedAt: manifest.UpdatedDateTime,
      syncedAt,
      documentCount: counts.documents,
      provisionCount: counts.provisions,
    });
  }
  builder.finish();
  atomicallyReplaceIndex(tempDb, options.dbPath);
  console.log(`Index ready: ${options.dbPath}`);
}

await main();

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { HkelIndex, HkelIndexBuilder, type IndexedDocument } from "../scripts/lib/hkel-index";

function document(capNo: string, title: string): IndexedDocument {
  return {
    language: "zh-Hant",
    capNo,
    capDisplay: `第 ${capNo} 章`,
    title,
    legislationType: "Ordinance",
    principalOrdinance: capNo,
    versionDate: "2026-08-01",
    status: "InEffect",
    pencilMarked: false,
    officialUrl: `https://www.elegislation.gov.hk/hk/cap${capNo}!zh-Hant-hk`,
    sourceFile: `cap${capNo}.xml`,
    sourceZipUrl: `https://example.test/cap${capNo}.zip`,
    sourceSha256: "a".repeat(64),
  };
}

test("searches separate ordinances and preserves official provenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "hkel-index-"));
  const path = join(directory, "test.db");
  try {
    const builder = new HkelIndexBuilder(path);
    builder.addDocument(document("106", "電訊條例"), [
      { provisionRef: "8", heading: "電訊牌照", bodyText: "任何人提供公共電訊服務必須持有牌照。", orderIndex: 0 },
    ]);
    builder.addDocument(document("486", "個人資料（私隱）條例"), [
      { provisionRef: "DPP4", heading: "個人資料保安", bodyText: "資料使用者須採取所有切實可行的步驟保障個人資料。", orderIndex: 0 },
    ]);
    builder.addSourceStatus({
      language: "zh-Hant",
      manifestUrl: "https://example.test/manifest.json",
      updatedAt: "2026-08-01T00:00:00Z",
      syncedAt: "2026-08-13T00:00:00Z",
      documentCount: 2,
      provisionCount: 2,
    });
    builder.finish();

    const index = new HkelIndex(path);
    const telecom = index.search({ query: "公共電訊服務 牌照", language: "zh-Hant" });
    const privacy = index.search({ query: "個人資料 保安", language: "zh-Hant" });
    assert.equal(telecom[0]?.capNo, "106");
    assert.equal(privacy[0]?.capNo, "486");
    assert.equal(privacy[0]?.sourceSha256, "a".repeat(64));
    assert.match(privacy[0]?.officialUrl ?? "", /elegislation\.gov\.hk/);
    assert.equal(index.sourceStatus()[0]?.provisionCount, 2);
    index.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { judiciaryDiscovery } from "../src/hk/judiciary";

test("returns a safe official Judiciary discovery link and deduplicated terms", () => {
  const result = judiciaryDiscovery(["電訊牌照", "電訊牌照", "個人資料"], "zh-Hant");
  const url = new URL(result.searchUrl);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "legalref.judiciary.hk");
  assert.deepEqual(result.keywords, ["電訊牌照", "個人資料"]);
});

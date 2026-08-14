import assert from "node:assert/strict";
import test from "node:test";
import { fallbackIssueMap } from "../src/hk/issue-map";

test("telecom customer-data question expands across adjacent legal domains", () => {
  const result = fallbackIssueMap(
    "在香港向消費者提供電訊服務並處理客戶資料，需要遵守哪些法例？",
    "zh-Hant",
  );
  const ids = result.issues.map((issue) => issue.id);
  assert.deepEqual(ids, [
    "telecom-licensing",
    "personal-data",
    "consumer-protection",
    "competition",
    "direct-marketing",
    "cybersecurity",
  ]);
  assert.equal(result.privacyRisk, "high");
});

// Benign unit tests for parsing Hong Kong legislation XML into searchable provisions.
import assert from "node:assert/strict";
import test from "node:test";
import { extractProvisions } from "../scripts/lib/hklm.ts";

test("extracts common HKLM provision-shaped nodes", () => {
  const doc = {
    ordinance: {
      section: [
        { num: "1", heading: "Short title", subsection: { text: "This Ordinance may be cited as the Example Ordinance." } },
        { num: "2", heading: "Interpretation", paragraph: { text: "company means a body corporate." } },
      ],
    },
  };
  const rows = extractProvisions(doc);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.provisionRef, "1");
  assert.equal(rows[0]?.heading, "Short title");
  assert.match(rows[1]?.bodyText ?? "", /company means a body corporate/);
});

test("falls back to one full-text record when no provision node is found", () => {
  const rows = extractProvisions({ document: { main: { text: "Fallback legal text" } } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.provisionRef, "full-text");
});

test("extracts a current HKLM section with nested subsections and its name attribute", () => {
  const rows = extractProvisions({
    ordinance: {
      main: {
        part: {
          section: {
            "@_name": "s7",
            num: "7.",
            heading: "Protection of data",
            subsection: [
              { num: "(1)", content: "A data user shall take all practicable steps." },
              { num: "(2)", paragraph: { num: "(a)", content: "Personal data must be protected." } },
            ],
          },
        },
      },
    },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.provisionRef, "7.");
  assert.equal(rows[0]?.heading, "Protection of data");
  assert.match(rows[0]?.bodyText ?? "", /Personal data must be protected/);
});

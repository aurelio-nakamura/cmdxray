// Positive-control coverage, one (or more) per program.
//
// Requested by @squid-protocol (issue #1): simple positive controls that
// prevent regressions on each program, wired into the workflow for adding new
// programs. This suite is data-driven off DB + EXAMPLES, so:
//   - every command in the knowledge base MUST ship at least one example, and
//   - every example must explain cleanly (command recognised, no flag left as
//     the "unknown option" fallback, and both renderers succeed).
// Add a command to DB without an EXAMPLES entry and this suite fails — keeping
// test coverage in lock-step with the knowledge base.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DB, EXAMPLES } from "../dist/db.js";
import { explain } from "../dist/explain.js";
import { renderSvg, renderTerminal, renderHtml } from "../dist/card.js";

const UNKNOWN_FLAG_GLOSS = "a command option";

test("every command in DB has at least one positive-control example", () => {
  const missing = Object.keys(DB).filter(
    (cmd) => !EXAMPLES[cmd] || EXAMPLES[cmd].length === 0,
  );
  assert.deepEqual(
    missing,
    [],
    `commands missing an EXAMPLES entry (add one when you add a command): ${missing.join(", ")}`,
  );
});

test("every EXAMPLES entry maps to a real command in DB", () => {
  const orphans = Object.keys(EXAMPLES).filter((cmd) => !DB[cmd]);
  assert.deepEqual(orphans, [], `EXAMPLES for commands not in DB: ${orphans.join(", ")}`);
});

for (const [cmd, examples] of Object.entries(EXAMPLES)) {
  for (const example of examples) {
    test(`positive control: ${example}`, () => {
      const r = explain(example);

      // 1) the command itself is recognised from the curated knowledge base.
      const cmdLine = r.lines.find((l) => l.token === cmd);
      assert.ok(cmdLine, `command token "${cmd}" not found in explanation`);
      assert.equal(cmdLine.source, "db", `"${cmd}" should resolve from the curated DB`);
      assert.equal(cmdLine.gloss, DB[cmd].summary);

      // 2) no flag in a curated example should fall through to "unknown option".
      const unknown = r.lines.filter((l) => l.gloss === UNKNOWN_FLAG_GLOSS);
      assert.deepEqual(
        unknown.map((l) => l.token),
        [],
        `unrecognised flag(s) in "${example}": ${unknown.map((l) => l.token).join(", ")}`,
      );

      // 3) every line has a non-empty gloss and a stable token/tokenIndex.
      for (const l of r.lines) {
        assert.ok(l.gloss && l.gloss.length > 0, `empty gloss for token "${l.token}"`);
        assert.ok(Number.isInteger(l.tokenIndex), "tokenIndex must be an integer");
      }

      // 4) all three renderers succeed on the explanation.
      const svg = renderSvg(r);
      assert.match(svg, /^<svg/);
      const html = renderHtml(r);
      assert.match(html, /<html/i);
      const term = renderTerminal(r, false);
      assert.ok(term.includes(cmd));
    });
  }
}

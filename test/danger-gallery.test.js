// Guards the curated "dangerous commands" gallery (docs/danger/*) against drift:
// every entry must still be flagged by the live risk engine, so a page titled
// "is X dangerous?" never renders with zero warnings after an engine change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { explain } from "../dist/explain.js";
import { DANGERS } from "../scripts/danger-data.mjs";

test("danger gallery is non-empty and slugs are unique", () => {
  assert.ok(DANGERS.length >= 10, "expected a substantial curated gallery");
  const slugs = new Set(DANGERS.map((d) => d.slug));
  assert.equal(slugs.size, DANGERS.length, "duplicate slug in danger gallery");
});

for (const d of DANGERS) {
  test(`danger gallery: ${d.slug} still produces a warning`, () => {
    const res = explain(d.cmd);
    const ws = res.warnings || [];
    assert.ok(ws.length >= 1, `no warnings for "${d.cmd}" — page would mislabel it as safe`);
    // every prose field present and non-trivial
    for (const f of ["label", "tagline", "what", "why", "safer"]) {
      assert.ok(typeof d[f] === "string" && d[f].length > 8, `missing/short ${f} for ${d.slug}`);
    }
  });
}

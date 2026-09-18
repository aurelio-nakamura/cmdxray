// Guards the curated "popular one-liners" gallery (docs/recipes/*) against drift:
// every recipe's command must resolve from the DB and render a clean token
// breakdown (no unrecognised flags), so a page titled "what does X do?" never
// renders with a broken or empty explanation after an engine/DB change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { explain } from "../dist/explain.js";
import { DB } from "../dist/db.js";
import { RECIPES } from "../scripts/recipes-data.mjs";

test("recipes gallery is non-empty and slugs are unique", () => {
  assert.ok(RECIPES.length >= 12, "expected a substantial curated gallery");
  const slugs = new Set(RECIPES.map((r) => r.slug));
  assert.equal(slugs.size, RECIPES.length, "duplicate slug in recipes gallery");
});

for (const r of RECIPES) {
  test(`recipe: ${r.slug} resolves and explains cleanly`, () => {
    const cmd0 = r.cmd.trim().split(/\s+/)[0];
    assert.ok(DB[cmd0], `base command "${cmd0}" not in DB for recipe ${r.slug}`);
    const res = explain(r.cmd);
    assert.ok(res.lines.length >= 1, `no breakdown for "${r.cmd}"`);
    const unknown = res.lines.filter((l) => /command option|unrecognised|unknown/i.test(l.gloss));
    assert.equal(unknown.length, 0, `unrecognised token(s) in "${r.cmd}": ${unknown.map((l) => l.token).join(", ")}`);
    for (const f of ["meaning", "detail"]) {
      assert.ok(typeof r[f] === "string" && r[f].length > 15, `missing/short ${f} for ${r.slug}`);
    }
  });
}

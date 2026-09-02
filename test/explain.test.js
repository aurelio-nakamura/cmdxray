import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../dist/parse.js";
import { explain } from "../dist/explain.js";
import { renderSvg, renderTerminal } from "../dist/card.js";

test("parses a pipeline into segments", () => {
  const p = parseCommand("grep -rn TODO src | head -20");
  assert.equal(p.segments.length, 2);
  assert.equal(p.segments[0].command, "grep");
  assert.equal(p.segments[1].command, "head");
});

test("splits combined short flags only when known", () => {
  const r = explain("tar -xzvf a.tgz");
  const flags = r.lines.filter((l) => l.token.startsWith("-")).map((l) => l.token);
  assert.deepEqual(flags, ["-x", "-z", "-v", "-f"]);
});

test("does NOT split find-style single-dash predicates", () => {
  const r = explain("find . -name '*.log' -mtime +30 -delete");
  const tokens = r.lines.map((l) => l.token);
  assert.ok(tokens.includes("-name"));
  assert.ok(tokens.includes("-mtime"));
  assert.ok(tokens.includes("-delete"));
  assert.ok(!tokens.includes("-n")); // must not have bundled n,a,m,e
});

test("numeric option is not treated as flags", () => {
  const r = explain("head -20 file.txt");
  const l = r.lines.find((x) => x.token === "-20");
  assert.ok(l);
  assert.match(l.gloss, /numeric/);
});

test("explains pipes and redirects", () => {
  const r = explain("cat x | sort > out.txt 2>&1");
  const glosses = Object.fromEntries(r.lines.map((l) => [l.token, l.gloss]));
  assert.match(glosses["|"], /pipe/);
  assert.match(glosses[">"], /redirect/);
  assert.match(glosses["2>&1"], /error output/);
});

test("curated flag glosses are used", () => {
  const r = explain("grep -i needle");
  const i = r.lines.find((l) => l.token === "-i");
  assert.match(i.gloss, /ignore case/);
});

test("renders svg and terminal without throwing", () => {
  const r = explain("docker run -it --rm -p 8080:80 nginx");
  const svg = renderSvg(r);
  assert.match(svg, /^<svg/);
  assert.ok(svg.includes("cmdxray"));
  const term = renderTerminal(r, false);
  assert.ok(term.includes("docker"));
});

test("command line and gloss colors line up by token index", () => {
  const r = explain("ls -la");
  // every gloss line points at a valid token index
  for (const l of r.lines) {
    assert.ok(l.tokenIndex >= 0 && l.tokenIndex < r.parsed.tokens.length);
  }
});

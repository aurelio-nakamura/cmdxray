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

test("recognizes subcommands (git commit, docker run, kubectl get)", () => {
  const g = explain("git commit -m x");
  const c = g.lines.find((l) => l.token === "commit");
  assert.match(c.gloss, /record staged changes/);

  const d = explain("docker run nginx");
  assert.match(d.lines.find((l) => l.token === "run").gloss, /start a new container/);

  const k = explain("kubectl get pods");
  assert.match(k.lines.find((l) => l.token === "get").gloss, /list resources/);
});

test("associates a flag value with its flag (curl -o file, -p host:container)", () => {
  const c = explain("curl -o out.html https://example.com");
  const v = c.lines.find((l) => l.token === "out.html");
  assert.match(v.gloss, /value for -o/);

  const d = explain("docker run -p 8080:80 nginx");
  const p = d.lines.find((l) => l.token === "8080:80");
  assert.match(p.gloss, /value for -p/);
});

test("value flag as the last of a combined short group takes the next word", () => {
  const r = explain("tar -xzvf archive.tgz");
  const v = r.lines.find((l) => l.token === "archive.tgz");
  assert.match(v.gloss, /value for -f/);
});

test("a filename that happens to match a subcommand name is not a subcommand", () => {
  // only the FIRST operand is treated as a subcommand
  const r = explain("git add commit");
  const occurrences = r.lines.filter((l) => l.token === "commit");
  assert.equal(occurrences.length, 1);
  assert.match(occurrences[0].gloss, /argument/);
});

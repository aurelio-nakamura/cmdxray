import { test } from "node:test";
import assert from "node:assert/strict";
import { sedGloss, awkGloss, jqGloss } from "../dist/scripts.js";
import { explain } from "../dist/index.js";

// --- sed scripts ---------------------------------------------------------
test("sed substitution with g flag", () => {
  const g = sedGloss("s/foo/bar/g");
  assert.match(g, /substitute/);
  assert.match(g, /replace "foo" with "bar"/);
  assert.match(g, /every match/);
});

test("sed substitution with alternate delimiter", () => {
  const g = sedGloss("s|/usr|/opt|");
  assert.match(g, /replace "\/usr" with "\/opt"/);
});

test("sed case-insensitive substitution", () => {
  const g = sedGloss("s/a/b/gi");
  assert.match(g, /case-insensitive/);
});

test("sed transliterate", () => {
  const g = sedGloss("y/abc/xyz/");
  assert.match(g, /transliterate/);
});

test("sed print with address", () => {
  const g = sedGloss("/error/p");
  assert.match(g, /print the matching line/);
  assert.match(g, /\/error\//);
});

test("sed delete line by number", () => {
  const g = sedGloss("3d");
  assert.match(g, /delete/);
});

test("sed non-command returns null", () => {
  assert.equal(sedGloss("file.txt"), null);
});

// --- awk programs --------------------------------------------------------
test("awk print a column", () => {
  const g = awkGloss("{print $1}");
  assert.match(g, /awk program/);
  assert.match(g, /\$1/);
});

test("awk with NR and pattern", () => {
  const g = awkGloss("NR>1 {print $2,$3}");
  assert.match(g, /NR = current line number/);
  assert.match(g, /\$2/);
});

test("awk regex pattern", () => {
  const g = awkGloss("/ERROR/{print}");
  assert.match(g, /only on lines matching \/ERROR\//);
});

test("awk plain operand returns null", () => {
  assert.equal(awkGloss("data.txt"), null);
});

// --- integration through explain() --------------------------------------
test("explain wires sed script gloss", () => {
  const res = explain("sed -i 's/foo/bar/g' file.txt", { manLookup: () => null });
  const line = res.lines.find((l) => l.token === "s/foo/bar/g");
  assert.ok(line, "sed script token present");
  assert.match(line.gloss, /substitute/);
});

test("explain wires awk program gloss", () => {
  const res = explain("awk '{print $1}' data.txt", { manLookup: () => null });
  const line = res.lines.find((l) => l.token === "{print $1}");
  assert.ok(line, "awk program token present");
  assert.match(line.gloss, /awk program/);
});

// --- jq filters ----------------------------------------------------------
test("jq field access", () => {
  assert.match(jqGloss(".name"), /get field \.name/);
});

test("jq iterate and select pipeline", () => {
  const g = jqGloss(".items[] | select(.age > 30) | .name");
  assert.match(g, /iterate over each element of \.items/);
  assert.match(g, /keep only items where \.age > 30/);
  assert.match(g, /get field \.name/);
});

test("jq builtins keys/length", () => {
  assert.match(jqGloss("keys"), /list its keys/);
  assert.match(jqGloss(".users | length"), /get its length/);
});

test("jq map and group_by", () => {
  assert.match(jqGloss("map(.id)"), /apply .* to each element/);
  assert.match(jqGloss("group_by(.type)"), /group by \.type/);
});

test("jq plain filename returns null", () => {
  assert.equal(jqGloss("data.json"), null);
});

test("explain wires jq filter gloss", () => {
  const res = explain("jq -r '.items[] | .name' data.json", { manLookup: () => null });
  const line = res.lines.find((l) => l.token === ".items[] | .name");
  assert.ok(line, "jq filter token present");
  assert.match(line.gloss, /jq filter/);
  const file = res.lines.find((l) => l.token === "data.json");
  assert.match(file.gloss, /argument passed/);
});

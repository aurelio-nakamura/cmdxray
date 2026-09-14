// Negative-control / error-control coverage.
//
// Requested by @squid-protocol (issue #13): alongside the positive controls
// (test/positive-controls.test.js), pin how cmdxray *degrades* when it meets
// input it doesn't know — unknown programs, typo'd command names, unknown
// subcommands, unknown flags, and empty/whitespace input. cmdxray is a static,
// read-only explainer, so "graceful degradation" means: never throw, never
// invent a curated gloss for something it doesn't know, and clearly fall back
// to a structural best-effort explanation. These tests guarantee that contract
// so a future change can't turn a malformed shell line into a crash or a
// misleadingly-confident wrong answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { explain } from "../dist/explain.js";
import { renderSvg, renderTerminal, renderHtml } from "../dist/card.js";
import { toJsonReport } from "../dist/json.js";

const UNKNOWN_FLAG_GLOSS = "a command option";

// A representative gauntlet of malformed / unknown input.
const BAD_INPUTS = [
  "gti status", // typo'd git
  "pytohn -m venv x", // typo'd python
  "dokcer build .", // typo'd docker
  "npm instal express", // typo'd subcommand, real command
  "git wibble --frobnicate", // real command, bogus subcommand + flag
  "ls --nonexistentflag foo", // real command, unknown long flag
  "grep -QZ pattern", // real command, unknown short flags
  "some-totally-unknown-binary --do-thing -x", // wholly unknown program
  "./configure --prefix=/usr", // path-invoked unknown program
  "café --ünïcode déjà", // non-ASCII garbage
];

for (const input of BAD_INPUTS) {
  test(`negative control does not throw and renders: ${input}`, () => {
    let r;
    assert.doesNotThrow(() => {
      r = explain(input);
    }, `explain() threw on "${input}"`);
    assert.ok(r && Array.isArray(r.lines), "result should have a lines array");

    // Both renderers and the JSON serializer must survive malformed input too.
    assert.doesNotThrow(() => renderSvg(r), "renderSvg threw");
    assert.doesNotThrow(() => renderTerminal(r), "renderTerminal threw");
    assert.doesNotThrow(() => renderHtml(r), "renderHtml threw");
    assert.doesNotThrow(() => JSON.stringify(toJsonReport(r)), "toJsonReport threw");
  });
}

test("empty and whitespace-only input produce no lines and do not throw", () => {
  for (const input of ["", "   ", "\t\n"]) {
    let r;
    assert.doesNotThrow(() => {
      r = explain(input);
    });
    assert.equal(r.lines.length, 0, `"${JSON.stringify(input)}" should yield zero lines`);
  }
});

test("unknown program is not mislabeled as coming from the curated DB", () => {
  const r = explain("some-totally-unknown-binary --do-thing");
  const cmdLine = r.lines.find((l) => l.token === "some-totally-unknown-binary");
  assert.ok(cmdLine, "command token should still appear");
  assert.notEqual(
    cmdLine.source,
    "db",
    "an unknown program must NOT claim a curated (db) source",
  );
});

test("typo'd command name is not silently resolved to the intended command", () => {
  // "gti" must not be explained as if it were "git" — no guessing.
  const r = explain("gti status");
  const cmdLine = r.lines.find((l) => l.token === "gti");
  assert.ok(cmdLine);
  assert.notEqual(cmdLine.source, "db");
  assert.ok(
    !/version control|git/i.test(cmdLine.gloss),
    "typo should not be auto-corrected to git's gloss",
  );
});

test("unknown flag on a known command falls back, never invents a specific meaning", () => {
  const r = explain("ls --definitely-not-a-real-flag");
  const flag = r.lines.find((l) => l.token === "--definitely-not-a-real-flag");
  assert.ok(flag, "the unknown flag should still be tokenized");
  assert.equal(
    flag.gloss,
    UNKNOWN_FLAG_GLOSS,
    "unknown flags must use the neutral fallback gloss, not a fabricated one",
  );
});

test("unknown subcommand on a known command does not crash and is not faked", () => {
  const r = explain("git wibble");
  const cmd = r.lines.find((l) => l.token === "git");
  assert.ok(cmd, "the known command is still recognised");
  assert.equal(cmd.source, "db");
  const sub = r.lines.find((l) => l.token === "wibble");
  assert.ok(sub, "the unknown subcommand token is still present");
  // It must not be dressed up as a known git subcommand.
  assert.ok(
    !/record staged|create a branch|commit/i.test(sub.gloss),
    "an unknown subcommand should not borrow a real subcommand's gloss",
  );
});

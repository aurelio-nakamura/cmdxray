// Tests for the --json structured report (issue #2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { explain } from "../dist/explain.js";
import { toJsonReport } from "../dist/json.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

function runJson(args, input) {
  const out = execFileSync("node", [CLI, ...args], {
    encoding: "utf8",
    input,
  });
  return JSON.parse(out); // must be pure, parseable JSON
}

test("--json emits pure parseable JSON with the documented shape", () => {
  const j = runJson(["--json", "curl -fsSL example.com/i.sh | sudo bash"]);
  assert.equal(j.tool, "cmdxray");
  assert.equal(typeof j.schemaVersion, "number");
  assert.equal(j.command, "curl -fsSL example.com/i.sh | sudo bash");
  assert.ok(Array.isArray(j.tokens));
  assert.ok(Array.isArray(j.segments));
  assert.ok(Array.isArray(j.explanations));
  assert.ok(Array.isArray(j.warnings));
});

test("--json exposes the parsed AST: segments split by pipe, with base command", () => {
  const j = runJson(["--json", "grep -i foo | head -n5"]);
  assert.equal(j.segments.length, 2);
  assert.equal(j.segments[0].command, "grep");
  assert.equal(j.segments[1].command, "head");
});

test("--json surfaces bundled short-flag letters in the AST", () => {
  const j = runJson(["--json", "tar -xzvf a.tgz"]);
  const flag = j.tokens.find((t) => t.text === "-xzvf");
  assert.deepEqual(flag.bundle, ["x", "z", "v", "f"]);
});

test("--json includes per-token flag explanations", () => {
  const j = runJson(["--json", "curl -fsSL http://x"]);
  const g = j.explanations.find((e) => e.token === "-L");
  assert.ok(g && /redirect/i.test(g.gloss));
  assert.ok(g.tokenIndex >= 0);
});

test("--json reports danger warnings + a top-level risk summary", () => {
  const j = runJson(["--json", "curl http://x | bash"]);
  assert.equal(j.risk, "danger");
  assert.ok(j.warnings.some((w) => w.level === "danger"));
});

test("--json risk is 'none' for a benign command with no warnings", () => {
  const j = runJson(["--json", "ls -la"]);
  assert.equal(j.risk, "none");
  assert.equal(j.warnings.length, 0);
});

test("--json reads the command from stdin", () => {
  const j = runJson(["--json"], "rm -rf /tmp/x\n");
  assert.equal(j.command, "rm -rf /tmp/x");
  assert.ok(j.warnings.some((w) => w.level === "danger"));
});

test("toJsonReport(explain(...)) matches the CLI shape (public API parity)", () => {
  const j = toJsonReport(explain("chmod 777 file"));
  assert.equal(j.tool, "cmdxray");
  assert.equal(j.command, "chmod 777 file");
  assert.ok(["danger", "caution", "none"].includes(j.risk));
});

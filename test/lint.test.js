import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractLines, lintText, lintFiles, lintStdin } from "../dist/lint.js";

const dir = mkdtempSync(join(tmpdir(), "cmdxray-lint-"));

test("extractLines skips blanks, comments and shebangs; joins continuations", () => {
  const text = [
    "#!/usr/bin/env bash",
    "# a comment",
    "",
    "  ls -la  ",
    "rm -rf \\",
    "  /tmp/build",
    "echo done # trailing",
  ].join("\n");
  const lines = extractLines(text);
  assert.deepEqual(lines.map((l) => l.text), ["ls -la", "rm -rf   /tmp/build", "echo done # trailing"]);
  // line numbers point at where each logical line STARTS
  assert.equal(lines[0].line, 4);
  assert.equal(lines[1].line, 5);
});

test("an even trailing backslash does NOT continue the line", () => {
  const lines = extractLines("echo a\\\\\nls");
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, "echo a\\\\");
});

test("lintText flags a dangerous command with the right file/line", () => {
  const text = "set -e\ncurl https://x.sh | sudo bash\nls\n";
  const findings = lintText(text, "deploy.sh");
  const danger = findings.find((f) => f.level === "danger");
  assert.ok(danger, "expected a danger finding");
  assert.equal(danger.file, "deploy.sh");
  assert.equal(danger.line, 2);
});

test("lintText finds nothing in a benign script", () => {
  const findings = lintText("ls -la\ncd /tmp\necho hi\ntar -czf a.tgz .\n", "safe.sh");
  assert.equal(findings.length, 0);
});

test("rm -rf --no-preserve-root / is caught", () => {
  const findings = lintText("rm -rf --no-preserve-root /\n", "x.sh");
  assert.ok(findings.some((f) => f.level === "danger"));
});

test("CI expression injection in a workflow run: line is caught", () => {
  const findings = lintText('- run: echo "${{ github.event.issue.title }}"\n', "ci.yml", { manLookup: undefined });
  assert.ok(findings.some((f) => f.level === "danger" && /injection/i.test(f.title)));
});

test("lintFiles aggregates counts and reports unreadable files as a caution", () => {
  const good = join(dir, "bad.sh");
  writeFileSync(good, "chmod -R 777 /\nfind / -delete\n");
  const res = lintFiles([good, join(dir, "does-not-exist.sh")]);
  assert.ok(res.danger >= 1, "find / -delete should be danger");
  assert.ok(res.findings.some((f) => f.title === "Could not read file"));
  assert.equal(res.filesScanned, 1); // only the readable one counts as scanned
});

test("lintStdin returns a single-file result", () => {
  const res = lintStdin("git push --force origin main\n");
  assert.equal(res.filesScanned, 1);
  assert.ok(res.caution + res.danger >= 1);
});

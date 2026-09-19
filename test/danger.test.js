import { test } from "node:test";
import assert from "node:assert/strict";
import { explain } from "../dist/explain.js";
import { analyzeDangers } from "../dist/danger.js";
import { parseCommand } from "../dist/parse.js";
import { renderSvg, renderTerminal } from "../dist/card.js";

const warn = (cmd) => explain(cmd, {}).warnings;
const titles = (cmd) => warn(cmd).map((w) => w.title);
const hasDanger = (cmd) => warn(cmd).some((w) => w.level === "danger");

test("curl | bash is flagged as running downloaded code unread", () => {
  const w = warn("curl -fsSL https://x.sh | bash");
  assert.ok(w.some((x) => x.level === "danger" && /downloaded code/i.test(x.title)));
});

test("wget | sudo sh is flagged (shell reached via sudo)", () => {
  assert.ok(hasDanger("wget -qO- https://x.sh | sudo sh"));
});

test("curl ; bash (sequential, not piped) is NOT flagged as run-downloaded", () => {
  const w = warn("curl -O https://x.sh ; bash");
  assert.ok(!w.some((x) => /downloaded code/i.test(x.title)));
});

test("rm -rf / escalates to a critical-path danger", () => {
  const w = warn("rm -rf /");
  assert.ok(w.some((x) => x.level === "danger" && /critical/i.test(x.title)));
});

test("rm -rf on an ordinary path is danger but not critical", () => {
  const w = warn("rm -rf build/");
  assert.ok(w.some((x) => x.level === "danger"));
  assert.ok(!w.some((x) => /critical/i.test(x.title)));
});

test("--no-preserve-root is its own danger", () => {
  assert.ok(titles("rm -rf --no-preserve-root /").some((t) => /safety guard/i.test(t)));
});

test("dd to a device is a danger", () => {
  assert.ok(hasDanger("dd if=/dev/zero of=/dev/sda bs=4M"));
});

test("mkfs formats a filesystem", () => {
  assert.ok(hasDanger("mkfs.ext4 /dev/sdb1"));
});

test("chmod 777 is a caution", () => {
  const w = warn("chmod -R 777 /var/www");
  assert.ok(w.some((x) => x.level === "caution" && /world-writable/i.test(x.title)));
});

test("sudo adds a runs-as-root caution", () => {
  assert.ok(titles("sudo apt update").some((t) => /root/i.test(t)));
});

test("git push --force is a caution", () => {
  assert.ok(titles("git push --force origin main").some((t) => /force-push/i.test(t)));
});

test("git reset --hard is a caution", () => {
  assert.ok(titles("git reset --hard HEAD~2").some((t) => /hard reset/i.test(t)));
});

test("fork bomb is detected", () => {
  assert.ok(hasDanger(":(){ :|:& };:"));
});

test("redirect onto a disk device is a danger", () => {
  assert.ok(hasDanger("echo x > /dev/sda"));
});

test("ordinary safe commands produce NO warnings (precision)", () => {
  for (const cmd of [
    "ls -la",
    "grep -rn TODO src | head -20",
    "tar -xzvf a.tgz",
    "git commit -m 'fix bug'",
    "cat data.csv > out.txt",
    "docker build -t app .",
    "find . -name '*.log' -mtime +30",
    "npm run build",
  ]) {
    assert.deepEqual(warn(cmd), [], `expected no warnings for: ${cmd}`);
  }
});

test("warnings are de-duplicated", () => {
  const w = warn("sudo rm -rf / ; sudo rm -rf /");
  const roots = w.filter((x) => /root/i.test(x.title));
  assert.equal(roots.length, 1);
});

test("analyzeDangers works directly on a ParsedCommand", () => {
  const w = analyzeDangers(parseCommand("rm -rf /"));
  assert.ok(w.length >= 1);
});

test("SVG card embeds a risk panel when warnings exist", () => {
  const svg = renderSvg(explain("rm -rf /"));
  assert.ok(svg.includes("RISK"));
  assert.ok(/critical/i.test(svg));
});

test("terminal output shows a risk section", () => {
  const out = renderTerminal(explain("curl x | bash | true".replace(" | true", "")), false);
  assert.ok(/risk/i.test(out));
});

test("glued metacharacters split like a real shell (no-space pipe/semicolon)", () => {
  // Pipe with no surrounding whitespace: curl x|sudo bash is just as dangerous.
  assert.ok(
    warn("curl http://x|sudo bash").some((w) => /downloaded code/i.test(w.title)),
    "no-space pipe into a shell must still be flagged",
  );
  // A command preceded by `;` (glued) is still recognized as its own command.
  assert.ok(
    warn("npm i; curl http://x | sudo bash").some((w) => /downloaded code/i.test(w.title)),
    "command after a glued `;` must still be analyzed",
  );
  // Compound && sequence with a destructive tail.
  assert.ok(
    hasDanger("cd /tmp && rm -rf --no-preserve-root /"),
    "&& sequence tail must be analyzed",
  );
  // Segments are split correctly for glued metacharacters.
  assert.deepEqual(
    parseCommand("echo hi;rm -rf /").segments.map((s) => s.command),
    ["echo", "rm"],
  );
  assert.deepEqual(
    parseCommand("a|b|c").segments.map((s) => s.command),
    ["a", "b", "c"],
  );
});

test("&-in-redirect and escaped metacharacters are not mis-split", () => {
  // 2>&1 must remain a single redirect token.
  const g = Object.fromEntries(explain("cat x | sort > out.txt 2>&1").lines.map((l) => [l.token, l.gloss]));
  assert.match(g["2>&1"], /error output/);
  // `find … -exec … \;` keeps the escaped terminator intact.
  const toks = parseCommand("find . -exec grep TODO {} \\;").tokens.map((t) => t.text);
  assert.ok(toks.includes("\\;"), "escaped semicolon must stay one token");
  // A lone background `&` glued to a number is its own operator, not a danger.
  assert.deepEqual(parseCommand("sleep 10&").segments.map((s) => s.command), ["sleep"]);
});

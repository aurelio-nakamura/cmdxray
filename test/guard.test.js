import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { checkCommand, bashGuardScript, unsupportedShellMessage } from "../dist/guard.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

// Run `cmdxray check …` and capture stdout + exit code (never throws on rc=1).
function runCheck(args) {
  const r = spawnSync(process.execPath, [CLI, "check", "--no-man", ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test("checkCommand classifies risk levels", () => {
  assert.equal(checkCommand("rm -rf --no-preserve-root /").risk, "danger");
  assert.equal(checkCommand("curl http://x | sudo bash").risk, "danger");
  assert.equal(checkCommand("git push --force").risk, "caution");
  assert.equal(checkCommand("ls -la").risk, "none");
});

test("`check` exit code encodes the verdict (0 = safe, 1 = danger)", () => {
  assert.equal(runCheck(["rm -rf --no-preserve-root /"]).code, 1);
  assert.equal(runCheck(["ls -la"]).code, 0);
  assert.equal(runCheck(["--", "curl http://x|sudo bash"]).code, 1);
});

test("caution only fails under --strict", () => {
  assert.equal(runCheck(["--", "git push --force"]).code, 0);
  assert.equal(runCheck(["--strict", "--", "git push --force"]).code, 1);
});

test("--quiet is silent on safe commands, speaks on risky ones", () => {
  const safe = runCheck(["--quiet", "--", "git status"]);
  assert.equal(safe.code, 0);
  assert.equal(safe.out.trim(), "");
  const bad = runCheck(["--quiet", "--", "rm -rf --no-preserve-root /"]);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /DANGER/);
});

test("--json emits a structured report", () => {
  const r = runCheck(["--json", "--", "dd if=/dev/zero of=/dev/sda"]);
  const rep = JSON.parse(r.out);
  assert.equal(rep.risk, "danger");
  assert.ok(rep.warnings.length >= 1);
  assert.equal(r.code, 1);
});

test("check reads a command from stdin", () => {
  const r = spawnSync(process.execPath, [CLI, "check", "--no-man", "--quiet"], {
    encoding: "utf8",
    input: "rm -rf --no-preserve-root /",
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /DANGER/);
});

test("guard bash emits a valid, literal bash hook (no JS interpolation leak)", () => {
  const script = bashGuardScript();
  // the bash parameter expansions must survive verbatim
  assert.match(script, /\$\{CMDXRAY_GUARD_BIN:-cmdxray\}/);
  assert.match(script, /\$\{#FUNCNAME\[@\]\}/);
  assert.match(script, /trap '__cmdxray_guard' DEBUG/);
  assert.match(script, /shopt -s extdebug/);
  assert.ok(!script.includes("undefined"));
  // it must be syntactically valid bash
  const f = join(tmpdir(), `cmdxray-guard-${process.pid}.sh`);
  writeFileSync(f, script);
  const r = spawnSync("bash", ["-n", f], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("guard via the CLI matches the library output", () => {
  const out = execFileSync(process.execPath, [CLI, "guard", "bash"], { encoding: "utf8" });
  assert.equal(out, bashGuardScript());
});

test("guard for an unsupported shell prints a helpful note, not a broken hook", () => {
  const msg = unsupportedShellMessage("fish");
  assert.match(msg, /no built-in guard for "fish"/);
  const out = execFileSync(process.execPath, [CLI, "guard", "fish"], { encoding: "utf8" });
  assert.match(out, /fish/);
  assert.ok(!out.includes("trap '__cmdxray_guard' DEBUG"));
});

// End-to-end: the hook actually BLOCKS a flagged command in a real interactive
// bash when the user declines. Uses a stub bin (exit 1 = danger) to isolate the
// hook wiring from the engine (engine classification is covered above).
test("the bash guard blocks a flagged command when the user answers no", { timeout: 20000 }, () => {
  const script = bashGuardScript();
  const py = `
import pty, os, sys, time, select
guard = open('/tmp/_cmdxray_guard_hook.sh').read()
stub = '/tmp/_cmdxray_stub.sh'
open(stub,'w').write('#!/usr/bin/env bash\\necho "DANGER (stub)"\\nexit 1\\n'); os.chmod(stub,0o755)
rc = '/tmp/_cmdxray_guard_rc.sh'
open(rc,'w').write('export CMDXRAY_GUARD_BIN="'+stub+'"\\nPS1="RDY> "\\n'+guard+'\\n')
os.system('rm -rf /tmp/_cmdxray_probe && mkdir -p /tmp/_cmdxray_probe')
cmds=[b"rmdir /tmp/_cmdxray_probe\\n", b"n\\n", b"exit\\n"]
pid,fd=pty.fork()
if pid==0: os.execvp('bash',['bash','--rcfile',rc,'-i'])
buf=b""; it=iter(cmds)
def feed():
    try: os.write(fd,next(it)); return True
    except StopIteration: return False
time.sleep(0.5); feed(); end=time.time()+15
while time.time()<end:
    r,_,_=select.select([fd],[],[],0.5)
    if r:
        try: d=os.read(fd,4096)
        except OSError: break
        if not d: break
        buf+=d
        if b"Run it anyway" in d or b"RDY>" in d:
            time.sleep(0.15); feed()
print("BLOCKED" if os.path.isdir('/tmp/_cmdxray_probe') else "RAN")
`;
  execFileSync("bash", ["-c", `cat > /tmp/_cmdxray_guard_hook.sh`], { input: script });
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  // If python3/pty isn't available, skip rather than fail the whole suite.
  if (r.status !== 0 || !r.stdout) {
    console.warn("guard pty test skipped:", r.stderr?.slice(0, 200));
    return;
  }
  assert.match(r.stdout, /BLOCKED/);
});

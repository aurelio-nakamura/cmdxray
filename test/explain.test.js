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

test("subcommand-specific flag meaning wins over the base flag", () => {
  // docker build -t = tag (base docker -t = tty)
  const b = explain("docker build -t myimg .");
  const t = b.lines.find((l) => l.token === "-t");
  assert.match(t.gloss, /tag/);
  const v = b.lines.find((l) => l.token === "myimg");
  assert.match(v.gloss, /value for -t/);

  // kubectl logs -f = follow (base kubectl -f = file), and does NOT eat the pod name
  const k = explain("kubectl logs -f pod-name");
  const f = k.lines.find((l) => l.token === "-f");
  assert.match(f.gloss, /follow/);
  const pod = k.lines.find((l) => l.token === "pod-name");
  assert.match(pod.gloss, /argument/);
});

test("bare (no-dash) flag cluster expands: tar czf, ps aux", () => {
  const t = explain("tar czf backup.tgz /home");
  for (const l of ["c", "z", "f"]) {
    assert.ok(t.lines.find((x) => x.token === l), `expected ${l} expanded`);
  }
  const v = t.lines.find((l) => l.token === "backup.tgz");
  assert.match(v.gloss, /value for f/);

  const p = explain("ps aux");
  for (const l of ["a", "u", "x"]) {
    assert.ok(p.lines.find((x) => x.token === l), `expected ${l} expanded`);
  }
});

test("bare flag cluster does not misfire on ordinary operands", () => {
  // grep is not bareFlags; 'src' must remain a plain argument, not a/c-flag soup
  const g = explain("grep -rn TODO src");
  const s = g.lines.find((l) => l.token === "src");
  assert.match(s.gloss, /argument/);
});

test("ffmpeg -vf is one option, not split into -v -f", () => {
  const r = explain("ffmpeg -i in.mp4 -vf scale=1280:-1 -an out.webm");
  const tokens = r.lines.map((l) => l.token);
  assert.ok(tokens.includes("-vf"), "-vf kept whole");
  assert.ok(!tokens.includes("-v"), "must not split into -v");
  const vf = r.lines.find((l) => l.token === "-vf");
  assert.match(vf.gloss, /video filter/);
  const an = r.lines.find((l) => l.token === "-an");
  assert.match(an.gloss, /no audio|drop the audio/);
});

test("ffmpeg -c:v links its value and is codec-accurate", () => {
  const r = explain("ffmpeg -i a.mov -c:v libx264 -crf 23 out.mp4");
  const cv = r.lines.find((l) => l.token === "-c:v");
  assert.match(cv.gloss, /video codec/);
  const val = r.lines.find((l) => l.token === "libx264");
  assert.equal(val.gloss, "value for -c:v");
});

test("openssl subcommand + long single-dash options are accurate", () => {
  const r = explain("openssl req -x509 -newkey rsa:4096 -keyout key.pem -days 365 -nodes");
  const req = r.lines.find((l) => l.token === "req");
  assert.match(req.gloss, /certificate signing request|CSR/);
  const nk = r.lines.find((l) => l.token === "-newkey");
  assert.match(nk.gloss, /new key/);
  const val = r.lines.find((l) => l.token === "rsa:4096");
  assert.equal(val.gloss, "value for -newkey");
  const nodes = r.lines.find((l) => l.token === "-nodes");
  assert.match(nodes.gloss, /don't encrypt|no passphrase/);
});

test("find -exec explains the nested command's own flags", () => {
  const r = explain("find . -name '*.js' -exec grep -l TODO {} \\;");
  const byTok = Object.fromEntries(r.lines.map((l) => [l.token, l.gloss]));
  // the nested command word is recognized as a command, not an opaque argument
  assert.match(byTok["grep"], /search input for lines/);
  // grep's own -l is glossed in the nested context (not "a command option")
  assert.match(byTok["-l"], /names of files with matches/i);
  // the placeholder and terminator are explained
  assert.match(byTok["{}"], /placeholder/i);
  assert.match(byTok["\\;"], /end of the -exec/i);
  // the pattern after -name is its value, not a bare argument
  assert.match(byTok["*.js"], /value for -name/);
});

test("xargs explains the command it runs and its NUL flag", () => {
  const r = explain("xargs -0 rm -f");
  const byTok = Object.fromEntries(r.lines.map((l) => [l.token, l.gloss]));
  assert.match(byTok["-0"], /NUL/); // not "a numeric option"
  assert.match(byTok["rm"], /remove files/); // rm recognized as the run command
  assert.match(byTok["-f"], /force/i); // rm's -f, in the nested context
});

test("netstat combined flags are expanded and curated", () => {
  const r = explain("netstat -tulpn");
  const flags = r.lines.filter((l) => l.token.startsWith("-")).map((l) => l.token);
  assert.deepEqual(flags, ["-t", "-u", "-l", "-p", "-n"]);
  const byTok = Object.fromEntries(r.lines.map((l) => [l.token, l.gloss]));
  assert.match(byTok["-l"], /listening/i);
});

test("inline variable assignment after a command is recognized", () => {
  const r = explain("export PATH=$PATH:/usr/local/bin");
  const asg = r.lines.find((l) => l.token.startsWith("PATH="));
  assert.ok(asg);
  assert.match(asg.gloss, /set PATH/);
});

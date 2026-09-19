#!/usr/bin/env node
// cmdxray — CLI entry point.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { explain } from "./explain.js";
import { renderTerminal, renderSvg, renderHtml } from "./card.js";
import { toJsonReport } from "./json.js";
import { runBatch } from "./batch.js";
import { lintFiles, lintStdin, type LintResult, type LintFinding } from "./lint.js";
import type { CommandInfo } from "./db.js";

const PLAYGROUND = "https://aurelio-nakamura.github.io/cmdxray/";

const HELP = `cmdxray — x-ray any shell command, offline.

Usage:
  cmdxray <command...>            explain a command (+ flag any risky parts) in your terminal
  cmdxray --svg <command...>      emit a shareable SVG card to stdout
  cmdxray --html <command...>     emit a standalone HTML page to stdout
  cmdxray --json <command...>     emit a structured JSON report to stdout
  cmdxray --batch-json            read a JSON array of commands from stdin, emit a JSON array of reports
  cmdxray lint <files...>         scan scripts/CI files for dangerous commands (CI/pre-commit gate)
  cmdxray -o card.svg <command>   write the SVG card to a file
  cmdxray --share <command...>    print a shareable link to the breakdown
  echo "<cmd>" | cmdxray          read the command from stdin

Options:
  --svg          output an SVG card
  --html         output a standalone HTML page
  --json         output a structured JSON report (parsed AST + explanations + risk warnings)
  --batch-json   read a JSON array of command strings from stdin, emit a JSON array of
                 --json reports (one process, no per-command startup cost — for CI/bulk scans)
  -o <file>      write output to <file> (format inferred from extension: .svg/.html/.json)
  --share      also print a shareable playground link for the command
  --link       print ONLY the shareable playground link (no explanation)
  --no-color   disable ANSI colors in terminal output
  --no-man     do not consult local man pages for unknown commands
  -h, --help   show this help

Everything runs locally. Nothing is uploaded.`;

const LINT_HELP = `cmdxray lint — scan files for dangerous shell commands, offline.

Usage:
  cmdxray lint <file...>       scan one or more files (shell scripts, Dockerfiles,
                               CI YAML, Makefiles, git hooks) for risky commands
  cmdxray lint                 read a script from stdin
  cat deploy.sh | cmdxray lint

Options:
  --strict       exit non-zero on CAUTION findings too (default: only DANGER fails)
  --exit-zero    always exit 0 (report findings without failing the build)
  --json         emit findings as JSON (for programmatic use)
  --quiet        print only findings (suppress the "scanned N files" summary)
  --no-color     disable ANSI colors
  --no-man       do not consult local man pages for unknown commands

Exit codes: 0 = clean, 1 = risky command found, 2 = usage error.
A heuristic, line-oriented scan powered by cmdxray's offline danger engine
(rm -rf /, curl | sudo bash, chmod -R 777 /, dd/mkfs/shred to a device,
git push --force, CI \${{ }} injection sinks, ...). Everything runs locally.`;

// Render lint findings for the terminal. Groups nothing — prints one line per
// finding in the familiar `file:line: LEVEL  title` linter format, followed by
// the offending command and a one-line reason, so it reads well in CI logs.
function renderLint(result: LintResult, color: boolean, quiet: boolean): string {
  const c = (code: string, s: string) => (color ? `\u001b[${code}m${s}\u001b[0m` : s);
  const out: string[] = [];
  for (const f of result.findings) {
    const loc = f.line > 0 ? `${f.file}:${f.line}` : f.file;
    const badge = f.level === "danger" ? c("1;31", "DANGER ") : c("1;33", "CAUTION");
    out.push(`${c("1", loc)}: ${badge}  ${f.title}`);
    if (f.command) out.push(`    ${c("2", "> " + f.command)}`);
    out.push(`    ${c("2", f.detail)}`);
    out.push("");
  }
  if (!quiet) {
    const parts = [`scanned ${result.filesScanned} file(s), ${result.linesScanned} command line(s)`];
    if (result.danger) parts.push(c("1;31", `${result.danger} danger`));
    if (result.caution) parts.push(c("1;33", `${result.caution} caution`));
    if (!result.danger && !result.caution) parts.push(c("1;32", "no risky commands found"));
    out.push(parts.join(" — "));
  }
  return out.join("\n");
}

// Build a shareable playground deep-link for a command. The link opens the
// in-browser playground with the command pre-loaded and its card rendered.
// URLSearchParams on the page decodes this back to the exact command.
export function shareLink(raw: string): string {
  return PLAYGROUND + "?cmd=" + encodeURIComponent(raw);
}

// Best-effort: read the one-line summary from a local man page (Node only).
function makeManLookup(): (cmd: string) => CommandInfo | null {
  const cache = new Map<string, CommandInfo | null>();
  return (cmd: string) => {
    if (!/^[A-Za-z0-9_.-]+$/.test(cmd)) return null;
    if (cache.has(cmd)) return cache.get(cmd)!;
    let info: CommandInfo | null = null;
    try {
      const out = execFileSync("man", [cmd], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, MANWIDTH: "200", MANPAGER: "cat", PAGER: "cat" },
        timeout: 2500,
      });
      const idx = out.indexOf("NAME");
      if (idx >= 0) {
        const after = out.slice(idx + 4).split("\n").map((l) => l.trim()).filter(Boolean);
        const nameLine = after[0] ?? "";
        const dash = nameLine.indexOf(" - ");
        const summary = dash >= 0 ? nameLine.slice(dash + 3).trim() : "";
        if (summary) info = { summary: summary.replace(/\s+/g, " "), flags: {} };
      }
    } catch {
      info = null;
    }
    cache.set(cmd, info);
    return info;
  };
}

// `cmdxray lint …` — a self-contained subcommand (a CI / pre-commit gate).
// Kept separate from the explainer's argv handling because its trailing tokens
// are FILE PATHS, not a command line to be explained.
function runLint(rest: string[]): void {
  let json = false;
  let strict = false;
  let exitZero = false;
  let quiet = false;
  let color = true;
  let useMan = true;
  const files: string[] = [];
  for (const a of rest) {
    if (a === "-h" || a === "--help") {
      console.log(LINT_HELP);
      return;
    } else if (a === "--json") json = true;
    else if (a === "--strict") strict = true;
    else if (a === "--exit-zero") exitZero = true;
    else if (a === "--quiet") quiet = true;
    else if (a === "--no-color") color = false;
    else if (a === "--no-man") useMan = false;
    else if (a.startsWith("-") && a !== "-") {
      console.error(`cmdxray lint: unknown option ${a}\n`);
      console.error(LINT_HELP);
      process.exitCode = 2;
      return;
    } else files.push(a);
  }

  const manLookup = useMan ? makeManLookup() : undefined;
  let result: LintResult;
  if (files.length === 0) {
    if (process.stdin.isTTY) {
      console.error("cmdxray lint: no files given and nothing on stdin.\n");
      console.error(LINT_HELP);
      process.exitCode = 2;
      return;
    }
    let input = "";
    try {
      input = readFileSync(0, "utf8");
    } catch {
      console.error("cmdxray lint: could not read from stdin.");
      process.exitCode = 2;
      return;
    }
    result = lintStdin(input, { manLookup });
  } else {
    result = lintFiles(files, { manLookup });
  }

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const rendered = renderLint(result, color, quiet);
    if (rendered) process.stdout.write(rendered + "\n");
  }

  if (exitZero) return;
  const failed = strict ? result.danger + result.caution : result.danger;
  if (failed > 0) process.exitCode = 1;
}

function main() {
  const argv = process.argv.slice(2);

  // `cmdxray lint …` dispatches to the file/CI scanner (a distinct subcommand).
  if (argv[0] === "lint") {
    runLint(argv.slice(1));
    return;
  }

  let format: "term" | "svg" | "html" | "json" = "term";
  let outFile: string | null = null;
  let color: boolean = true;
  let useMan: boolean = true;
  let share: boolean = false;
  let linkOnly: boolean = false;
  let batch: boolean = false;
  let showHelp: boolean = false;
  const rest: string[] = [];
  // cmdxray's own options are recognized BEFORE the command word (or after an
  // explicit `--`). Once a MULTI-TOKEN command begins, every remaining token
  // belongs to it — so a target command's own -o/--html/etc. are never swallowed
  // by cmdxray. EXCEPTION: when the whole command is supplied as a single
  // whitespace-containing quoted token (e.g. `cmdxray "grep foo | head" --svg`),
  // the command is fully self-contained inside that one token, so trailing
  // cmdxray options after it are unambiguous and are honored.
  const isCmdxrayOpt = (a: string) =>
    a === "--svg" || a === "--html" || a === "--json" || a === "--batch-json" || a === "--no-color" || a === "--no-man" ||
    a === "-o" || a === "--share" || a === "--link";
  let inCommand = false;
  let quotedCommand = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // Inside a MULTI-token command, everything belongs to the command. Inside a
    // fully-quoted command, trailing cmdxray options are still honored.
    if (inCommand && !(quotedCommand && isCmdxrayOpt(a))) {
      rest.push(a);
      continue;
    }
    if (a === "-h" || a === "--help") showHelp = true;
    else if (a === "--") inCommand = true;
    else if (a === "--svg") format = "svg";
    else if (a === "--html") format = "html";
    else if (a === "--json") format = "json";
    else if (a === "--batch-json") batch = true;
    else if (a === "--no-color") color = false;
    else if (a === "--no-man") useMan = false;
    else if (a === "--share") share = true;
    else if (a === "--link") linkOnly = true;
    else if (a === "-o") outFile = argv[++i] ?? null;
    else {
      // first non-cmdxray token = start of the command line
      inCommand = true;
      quotedCommand = /\s/.test(a);
      rest.push(a);
    }
  }

  // `-h`/`--help` is cmdxray's own help ONLY when it appears before the command
  // word. Once a command has begun, its own -h (e.g. `ls -h`, `ssh -h host`)
  // belongs to that command and is explained normally.
  if (showHelp && rest.length === 0) {
    console.log(HELP);
    return;
  }

  // --batch-json: read a JSON array of commands from stdin and emit a JSON array
  // of reports in one process (no per-command Node startup cost). For CI/bulk
  // scanners that x-ray thousands of embedded shell snippets (issue #3).
  if (batch) {
    let input = "";
    try {
      input = readFileSync(0, "utf8");
    } catch {
      console.error("cmdxray --batch-json: could not read a JSON array of commands from stdin.");
      process.exitCode = 1;
      return;
    }
    const manLookup = useMan ? makeManLookup() : undefined;
    try {
      const reports = runBatch(input, { manLookup });
      process.stdout.write(JSON.stringify(reports, null, 2) + "\n");
    } catch (e) {
      console.error((e as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  // Reconstruct the command line from the surviving argv tokens.
  //  - If the shell already split the command into multiple tokens (rest.length
  //    > 1), a whitespace-containing token is a genuine single argument (e.g.
  //    commit -m "fix bug"), so re-quote it to preserve how it was typed.
  //  - If there is exactly one token, the whole command line was passed as one
  //    quoted argument (e.g. cmdxray "git commit -m fix && docker run"); use it
  //    verbatim so the parser tokenizes it, instead of treating it as one word.
  let raw =
    rest.length === 1
      ? rest[0].trim()
      : rest
          .map((t) => (/\s/.test(t) && !/^["']/.test(t) ? JSON.stringify(t) : t))
          .join(" ")
          .trim();
  if (!raw && !process.stdin.isTTY) {
    try {
      raw = readFileSync(0, "utf8").trim();
    } catch {
      /* ignore */
    }
  }
  if (!raw) {
    console.log(HELP);
    process.exitCode = 1;
    return;
  }

  // --link short-circuits: print only the shareable playground URL (handy to
  // pipe into a clipboard, e.g. `cmdxray --link <cmd> | pbcopy`).
  if (linkOnly) {
    process.stdout.write(shareLink(raw) + "\n");
    return;
  }

  const manLookup = useMan ? makeManLookup() : undefined;
  const res = explain(raw, { manLookup });

  if (outFile) {
    const isHtml = outFile.endsWith(".html") || outFile.endsWith(".htm");
    const isJson = outFile.endsWith(".json") || format === "json";
    const content = isJson
      ? JSON.stringify(toJsonReport(res), null, 2)
      : isHtml
        ? renderHtml(res)
        : renderSvg(res);
    writeFileSync(outFile, content);
    console.error(`cmdxray: wrote ${outFile}`);
    return;
  }

  if (format === "svg") process.stdout.write(renderSvg(res) + "\n");
  else if (format === "html") process.stdout.write(renderHtml(res) + "\n");
  else if (format === "json") process.stdout.write(JSON.stringify(toJsonReport(res), null, 2) + "\n");
  else {
    process.stdout.write(renderTerminal(res, color) + "\n");
    if (share) {
      const link = shareLink(raw);
      const label = color ? `\u001b[2m🔗 Share:\u001b[0m ${link}` : `🔗 Share: ${link}`;
      process.stdout.write("\n" + label + "\n");
    }
  }
}

main();

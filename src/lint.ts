// cmdxray — lint mode.
// Scans shell scripts (and any file with embedded shell one-liners: Dockerfiles,
// CI YAML `run:` steps, Makefiles, git hooks) for DANGEROUS or risky commands
// using the SAME offline danger engine the explainer/MCP safety-gate ship.
//
// It is a HEURISTIC, line-oriented scan — not a full shell parser. Each logical
// line (comments stripped, backslash-continuations joined) is fed to the danger
// engine; any command that trips a risk rule (rm -rf /, curl | sudo bash,
// chmod -R 777 /, dd/mkfs/shred to a device, git push --force, a CI
// `${{ }}`-injection sink, …) is reported with its file and line number.
//
// This is deliberately conservative about false positives: the danger rules are
// high-precision (see src/danger.ts), so a finding almost always points at a
// genuinely destructive or injectable command worth a second look.

import { readFileSync } from "node:fs";
import { explain, ExplainOptions } from "./explain.js";
import type { RiskLevel, Warning } from "./danger.js";

export interface LintFinding {
  file: string;
  line: number; // 1-based line where the logical command starts
  command: string; // the logical command line that tripped a rule
  level: RiskLevel; // "danger" | "caution"
  title: string;
  detail: string;
}

export interface LintResult {
  findings: LintFinding[];
  danger: number; // count of danger-level findings
  caution: number; // count of caution-level findings
  filesScanned: number;
  linesScanned: number; // logical (command) lines actually analyzed
}

// A logical command line reconstructed from one or more physical source lines.
interface LogicalLine {
  text: string;
  line: number; // 1-based line number where this logical line begins
}

// Turn raw file text into the sequence of shell command lines worth analyzing.
//  - joins trailing backslash `\` continuations into one logical line
//  - drops blank lines and whole-line comments / shebangs (`#`, `#!`)
//  - keeps everything else verbatim (assignments, `if`/`then`/`fi`, pipelines);
//    the danger engine only warns on genuinely risky segments, so structural
//    keywords are harmless.
export function extractLines(text: string): LogicalLine[] {
  const raw = text.split(/\r?\n/);
  const out: LogicalLine[] = [];
  let buf = "";
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const physical = raw[i];
    if (buf === "") {
      const trimmed = physical.trim();
      if (trimmed === "") continue;
      if (trimmed.startsWith("#")) continue; // comment or shebang
      start = i + 1;
    }
    // Handle a line-continuation backslash (an ODD number of trailing
    // backslashes escapes the newline). Accumulate and keep reading.
    const m = physical.match(/(\\+)$/);
    if (m && m[1].length % 2 === 1) {
      buf += physical.slice(0, -1); // drop the escaping backslash, join
      continue;
    }
    buf += physical;
    const text2 = buf.trim();
    buf = "";
    if (text2 === "" || text2.startsWith("#")) continue;
    out.push({ text: text2, line: start });
  }
  if (buf.trim() !== "") out.push({ text: buf.trim(), line: start });
  return out;
}

// Analyze a single logical command line; return any risk warnings it trips.
function warningsFor(command: string, opts: ExplainOptions): Warning[] {
  try {
    return explain(command, opts).warnings;
  } catch {
    return []; // never let one weird line abort the scan
  }
}

export function lintText(text: string, file: string, opts: ExplainOptions = {}): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const { text: cmd, line } of extractLines(text)) {
    for (const w of warningsFor(cmd, opts)) {
      findings.push({ file, line, command: cmd, level: w.level, title: w.title, detail: w.detail });
    }
  }
  return findings;
}

// Lint a set of files (or the given inline texts). Missing/unreadable files are
// reported as a synthetic finding so the caller can surface them, but never
// throw — a scan over a glob should be robust.
export function lintFiles(files: string[], opts: ExplainOptions = {}): LintResult {
  const findings: LintFinding[] = [];
  let filesScanned = 0;
  let linesScanned = 0;
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch (e) {
      findings.push({
        file,
        line: 0,
        command: "",
        level: "caution",
        title: "Could not read file",
        detail: (e as Error).message,
      });
      continue;
    }
    filesScanned++;
    linesScanned += extractLines(text).length;
    findings.push(...lintText(text, file, opts));
  }
  return summarize(findings, filesScanned, linesScanned);
}

// Lint text read from stdin (a single pseudo-file, conventionally "<stdin>").
export function lintStdin(text: string, opts: ExplainOptions = {}): LintResult {
  const findings = lintText(text, "<stdin>", opts);
  return summarize(findings, 1, extractLines(text).length);
}

function summarize(findings: LintFinding[], filesScanned: number, linesScanned: number): LintResult {
  return {
    findings,
    danger: findings.filter((f) => f.level === "danger").length,
    caution: findings.filter((f) => f.level === "caution").length,
    filesScanned,
    linesScanned,
  };
}

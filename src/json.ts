// cmdxray — structured JSON report (for programmatic / pipeline use).
// Turns an ExplainResult into a stable, documented JSON shape that other tools
// can consume without scraping the human-readable terminal/SVG/HTML output.
//
// The shape is intentionally flat and self-describing so downstream scanners can
// index (a) the parsed command tree, (b) per-token flag explanations, and
// (c) the risk/danger warnings — the three things asked for in issue #2.

import type { ExplainResult } from "./explain.js";
import type { RiskLevel } from "./danger.js";

// Bump when the JSON contract changes in a backwards-incompatible way.
export const JSON_SCHEMA_VERSION = 1;

export interface JsonToken {
  text: string;
  kind: string; // TokenKind: command | shortFlag | longFlag | flagValue | operand | operator | pipe | redirect | subshell | assignment
  bundle?: string[]; // for a combined short flag like -xzvf -> ["x","z","v","f"]
  quoted?: boolean;
}

export interface JsonSegment {
  command: string | null; // the base program of this simple command, e.g. "grep"
  tokens: JsonToken[];
}

export interface JsonExplanation {
  token: string; // the piece of the command, e.g. "-x" or "archive.tar.gz"
  gloss: string; // plain-English meaning
  source: "db" | "man" | "generic" | "structure";
  tokenIndex: number; // index into the flat `tokens` array
}

export interface JsonWarning {
  level: RiskLevel; // "danger" | "caution"
  title: string;
  detail: string;
}

export interface JsonReport {
  tool: "cmdxray";
  schemaVersion: number;
  command: string; // the raw command line, as parsed
  risk: RiskLevel | "none"; // highest severity across all warnings ("danger" > "caution" > "none")
  tokens: JsonToken[]; // flat token stream, in order (mirrors the rendered command line)
  segments: JsonSegment[]; // the AST: simple commands split by pipes/operators
  explanations: JsonExplanation[]; // per-token flag/operand explanations
  warnings: JsonWarning[]; // risk analysis (curl|bash, rm -rf, chmod 777, ...)
}

function cleanToken(t: {
  text: string;
  kind: string;
  bundle?: string[];
  quoted?: boolean;
}): JsonToken {
  const out: JsonToken = { text: t.text, kind: t.kind };
  if (t.bundle && t.bundle.length) out.bundle = t.bundle;
  if (t.quoted) out.quoted = true;
  return out;
}

export function toJsonReport(res: ExplainResult): JsonReport {
  const risk: RiskLevel | "none" = res.warnings.some((w) => w.level === "danger")
    ? "danger"
    : res.warnings.some((w) => w.level === "caution")
      ? "caution"
      : "none";

  return {
    tool: "cmdxray",
    schemaVersion: JSON_SCHEMA_VERSION,
    command: res.raw,
    risk,
    tokens: res.parsed.tokens.map(cleanToken),
    segments: res.parsed.segments.map((s) => ({
      command: s.command,
      tokens: s.tokens.map(cleanToken),
    })),
    explanations: res.lines.map((l) => ({
      token: l.token,
      gloss: l.gloss,
      source: l.source,
      tokenIndex: l.tokenIndex,
    })),
    warnings: res.warnings.map((w) => ({
      level: w.level,
      title: w.title,
      detail: w.detail,
    })),
  };
}

// cmdxray — shell command parser.
// Tokenizes a command line into a structured tree: pipelines, operators,
// redirects, and per-command flags/operands. Pure, dependency-free.

export type TokenKind =
  | "command"
  | "shortFlag"
  | "longFlag"
  | "flagValue"
  | "operand"
  | "operator"
  | "pipe"
  | "redirect"
  | "subshell"
  | "assignment";

export interface Token {
  text: string;
  kind: TokenKind;
  // For a command's flags, the letters that make up a combined short flag (e.g. "xzvf" -> ["x","z","v","f"]).
  bundle?: string[];
  quoted?: boolean;
}

export interface Segment {
  // A single simple command within a pipeline, e.g. `grep -i foo`.
  command: string | null;
  tokens: Token[];
}

export interface ParsedCommand {
  raw: string;
  tokens: Token[]; // flat, in order, for rendering the command line
  segments: Segment[]; // simple commands split by pipes/operators
}

const OPERATORS = new Set(["&&", "||", ";", "&"]);
const REDIRECTS = new Set([">", ">>", "<", "<<", "2>", "2>>", "&>", ">&", "2>&1"]);

// Split a raw line into raw words, honoring single/double quotes and simple
// $(...) / `...` subshells (kept as a single word).
function lex(raw: string): { text: string; quoted: boolean }[] {
  const words: { text: string; quoted: boolean }[] = [];
  let cur = "";
  // `quoted` marks a word whose FIRST character was inside quotes — i.e. a
  // fully-quoted operand/program (awk '{...}', a sed script). A flag whose
  // VALUE is quoted (--include='*.py', -F',') starts unquoted, so it still
  // classifies as a flag.
  let quoted = false;
  let started = false;
  let i = 0;
  const push = () => {
    if (cur.length) words.push({ text: cur, quoted });
    cur = "";
    quoted = false;
    started = false;
  };
  while (i < raw.length) {
    const c = raw[i];
    if (c === " " || c === "\t" || c === "\n") {
      push();
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      if (!started) quoted = true;
      started = true;
      const q = c;
      i++;
      while (i < raw.length && raw[i] !== q) {
        cur += raw[i++];
      }
      i++; // closing quote
      continue;
    }
    if (c === "$" && raw[i + 1] === "(") {
      // subshell $(...)
      started = true;
      let depth = 1;
      cur += "$(";
      i += 2;
      while (i < raw.length && depth > 0) {
        if (raw[i] === "(") depth++;
        else if (raw[i] === ")") depth--;
        if (depth > 0) cur += raw[i];
        i++;
      }
      cur += ")";
      continue;
    }
    started = true;
    cur += c;
    i++;
  }
  push();
  return words;
}

function classifyWord(
  word: { text: string; quoted: boolean },
  expectCommand: boolean,
): Token {
  const { text, quoted } = word;
  if (!quoted && text === "|") return { text, kind: "pipe" };
  if (!quoted && OPERATORS.has(text)) return { text, kind: "operator" };
  if (!quoted && REDIRECTS.has(text)) return { text, kind: "redirect" };
  if (!quoted && /^\$\(.*\)$/.test(text)) return { text, kind: "subshell", quoted };
  if (expectCommand) {
    // VAR=value assignment before a command
    if (!quoted && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(text)) {
      return { text, kind: "assignment" };
    }
    return { text, kind: "command" };
  }
  if (!quoted && /^--[A-Za-z0-9][A-Za-z0-9-]*(=.*)?$/.test(text)) {
    return { text, kind: "longFlag" };
  }
  // A bare numeric option like `head -20` or `tail -5` is a count, not flags.
  if (!quoted && /^-\d+$/.test(text)) {
    return { text, kind: "operand" };
  }
  // Short flag(s): letters only bundle (so `-xzvf` splits, but `-o2` doesn't
  // treat the 2 as a flag — the trailing value stays attached).
  if (!quoted && /^-[A-Za-z]+$/.test(text)) {
    const letters = text.slice(1).split("");
    return { text, kind: "shortFlag", bundle: letters.length > 1 ? letters : undefined };
  }
  if (!quoted && /^-[A-Za-z]/.test(text)) {
    // e.g. -j4, -n1: a short flag with an attached value
    return { text, kind: "shortFlag" };
  }
  return { text, kind: "operand", quoted };
}

export function parseCommand(raw: string): ParsedCommand {
  const words = lex(raw.trim());
  const tokens: Token[] = [];
  const segments: Segment[] = [];
  let expectCommand = true;
  let seg: Segment = { command: null, tokens: [] };

  for (const w of words) {
    const tok = classifyWord(w, expectCommand);
    tokens.push(tok);

    if (tok.kind === "pipe" || tok.kind === "operator") {
      if (seg.tokens.length) segments.push(seg);
      seg = { command: null, tokens: [] };
      expectCommand = true;
      continue;
    }
    if (tok.kind === "assignment") {
      seg.tokens.push(tok);
      // still expecting the command after assignments
      continue;
    }
    if (tok.kind === "command") {
      seg.command = tok.text;
      expectCommand = false;
    }
    seg.tokens.push(tok);
  }
  if (seg.tokens.length) segments.push(seg);

  return { raw, tokens, segments };
}

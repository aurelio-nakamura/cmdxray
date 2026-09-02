// cmdxray — turn a parsed command into human explanations.
// Walks the flat token stream in order so the rendered command line and the
// gloss lines stay perfectly aligned (each token -> one or more gloss lines).

import { parseCommand, ParsedCommand } from "./parse.js";
import { DB, GENERIC_FLAGS, CommandInfo } from "./db.js";

export interface Explanation {
  token: string; // the piece of the command, e.g. "-x" or "archive.tar.gz"
  gloss: string; // plain-English meaning
  colorIndex: number; // stable color for linking command <-> gloss
  tokenIndex: number; // index into parsed.tokens this line belongs to
  source: "db" | "man" | "generic" | "structure";
}

export interface ExplainResult {
  raw: string;
  parsed: ParsedCommand;
  lines: Explanation[];
}

const OPERATOR_GLOSS: Record<string, string> = {
  "|": "pipe — send this command's output into the next command",
  "&&": "and-then — run the next command only if this one succeeds",
  "||": "or-else — run the next command only if this one fails",
  ";": "then — run the next command regardless of the previous result",
  "&": "run the preceding command in the background",
  ">": "redirect output into the given file (overwrite)",
  ">>": "redirect output onto the end of the given file (append)",
  "<": "read input from the given file",
  "2>": "redirect error output into the given file",
  "2>>": "append error output to the given file",
  "&>": "redirect both normal and error output into the given file",
  "2>&1": "send error output to the same place as normal output",
};

export interface ExplainOptions {
  manLookup?: (command: string) => CommandInfo | null;
}

export function explain(raw: string, opts: ExplainOptions = {}): ExplainResult {
  const parsed = parseCommand(raw);
  const lines: Explanation[] = [];
  let color = 0;
  let info: CommandInfo | null = null;
  let expectCommand = true;
  let sawSubcommand = false; // has this command already consumed its subcommand?
  let pendingValueFor: string | null = null; // a flag whose value is the next operand

  const add = (token: string, gloss: string, ti: number, source: Explanation["source"]) => {
    lines.push({ token, gloss, colorIndex: color++, tokenIndex: ti, source });
  };

  const takesValue = (info: CommandInfo | null, key: string) =>
    !!info?.takesValue?.includes(key);

  parsed.tokens.forEach((tok, ti) => {
    switch (tok.kind) {
      case "pipe":
      case "operator":
        add(tok.text, OPERATOR_GLOSS[tok.text] ?? "shell control operator", ti, "structure");
        info = null;
        expectCommand = true;
        sawSubcommand = false;
        pendingValueFor = null;
        break;
      case "redirect":
        add(tok.text, OPERATOR_GLOSS[tok.text] ?? "shell redirection", ti, "structure");
        break;
      case "assignment": {
        const [name] = tok.text.split("=");
        add(tok.text, `set the environment variable ${name} for this command`, ti, "structure");
        break;
      }
      case "command":
        info = DB[tok.text] ?? opts.manLookup?.(tok.text) ?? null;
        add(
          tok.text,
          info ? info.summary : `run the "${tok.text}" program`,
          ti,
          info ? (DB[tok.text] ? "db" : "man") : "structure",
        );
        expectCommand = false;
        sawSubcommand = false;
        break;
      case "subshell":
        add(tok.text, "run this inner command first and substitute its output", ti, "structure");
        break;
      case "longFlag": {
        const key = tok.text.split("=")[0];
        const hasInlineValue = tok.text.includes("=");
        const gloss = info?.flags[key] ?? GENERIC_FLAGS[key] ?? "a command option";
        add(tok.text, gloss, ti, info?.flags[key] ? "db" : GENERIC_FLAGS[key] ? "generic" : "structure");
        if (!hasInlineValue && takesValue(info, key)) pendingValueFor = tok.text;
        break;
      }
      case "shortFlag": {
        // 1) whole-token match (find-style: -name, -mtime, -delete)
        if (info?.flags[tok.text]) {
          add(tok.text, info.flags[tok.text], ti, "db");
          if (takesValue(info, tok.text)) pendingValueFor = tok.text;
          break;
        }
        const body = tok.text.replace(/^-/, "");
        const letters = body.split("");
        const known = (l: string) => info?.flags[l] ?? GENERIC_FLAGS[l];
        // 2) combined short flags (-xzvf) only if every letter is known
        if (letters.length > 1 && letters.every((l) => known(l) !== undefined)) {
          for (const l of letters) {
            add("-" + l, known(l)!, ti, info?.flags[l] ? "db" : "generic");
          }
          // if the LAST letter takes a value, the next operand is that value
          const last = letters[letters.length - 1];
          if (takesValue(info, last)) pendingValueFor = "-" + last;
          break;
        }
        // 3) numeric-ish or single/attached short flag: look up first letter
        const first = body.slice(0, 1);
        const gloss = known(first) ?? "a command option";
        add(tok.text, gloss, ti, info?.flags[first] ? "db" : GENERIC_FLAGS[first] ? "generic" : "structure");
        // a single short flag with no attached value that expects one
        if (body.length === 1 && takesValue(info, first)) pendingValueFor = tok.text;
        break;
      }
      case "operand": {
        // a) the value for a preceding flag (e.g. curl -o out.html)
        if (pendingValueFor) {
          add(tok.text, `value for ${pendingValueFor}`, ti, "structure");
          pendingValueFor = null;
          break;
        }
        // b) a subcommand (git commit, docker run, kubectl get)
        if (info?.subcommands && !sawSubcommand && info.subcommands[tok.text]) {
          add(tok.text, info.subcommands[tok.text], ti, "db");
          sawSubcommand = true;
          break;
        }
        // c) a whole-token flag used as an operand (find -delete style)
        if (info?.flags[tok.text]) {
          add(tok.text, info.flags[tok.text], ti, "db");
        } else if (/^-\d+$/.test(tok.text)) {
          add(tok.text, "a numeric option (often a count or limit)", ti, "structure");
        } else {
          add(tok.text, "an argument passed to the command", ti, "structure");
        }
        break;
      }
    }
  });

  return { raw, parsed, lines };
}

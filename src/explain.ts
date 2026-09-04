// cmdxray — turn a parsed command into human explanations.
// Walks the flat token stream in order so the rendered command line and the
// gloss lines stay perfectly aligned (each token -> one or more gloss lines).

import { parseCommand, ParsedCommand } from "./parse.js";
import { DB, GENERIC_FLAGS, CommandInfo } from "./db.js";
import { sedGloss, awkGloss, jqGloss, chmodModeGloss, killSignalGloss } from "./scripts.js";

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
  let cmdName: string | null = null; // the base command word (for interpreter scripts)
  let expectCommand = true;
  let sawSubcommand = false; // has this command already consumed its subcommand?
  let currentSub: string | null = null; // the active subcommand, if any
  let operandCount = 0; // operands seen for the current command (for bareFlags)
  let pendingValueFor: string | null = null; // a flag whose value is the next operand
  let nestedArmed = false; // next command-word operand starts a nested command (find -exec, xargs)
  let inNested = false; // currently glossing a nested command (for {} / ; / + tokens)

  const EXEC_FLAGS = new Set(["-exec", "-execdir", "-ok", "-okdir"]);

  // Switch the active command context to a nested command (the thing find -exec /
  // xargs actually runs). Everything after is glossed against THIS command.
  const enterNested = (word: string, ti: number, verb: string) => {
    info = DB[word] ?? opts.manLookup?.(word) ?? null;
    cmdName = word;
    add(
      word,
      info ? `${verb}: ${info.summary}` : `${verb} the "${word}" command`,
      ti,
      info ? (DB[word] ? "db" : "man") : "structure",
    );
    nestedArmed = false;
    inNested = true;
    sawSubcommand = false;
    currentSub = null;
    operandCount = 0;
    pendingValueFor = null;
  };

  const add = (token: string, gloss: string, ti: number, source: Explanation["source"]) => {
    lines.push({ token, gloss, colorIndex: color++, tokenIndex: ti, source });
  };

  // Subcommand-aware flag gloss: a subcommand's override wins over the base flag.
  const flagGloss = (info: CommandInfo | null, key: string): string | undefined => {
    if (currentSub) {
      const sf = info?.subFlags?.[currentSub];
      if (sf && key in sf) return sf[key];
    }
    return info?.flags[key];
  };

  const takesValue = (info: CommandInfo | null, key: string) => {
    if (currentSub) {
      const sf = info?.subFlags?.[currentSub];
      if (sf && key in sf) return !!info?.subTakesValue?.[currentSub]?.includes(key);
    }
    return !!info?.takesValue?.includes(key);
  };

  parsed.tokens.forEach((tok, ti) => {
    switch (tok.kind) {
      case "pipe":
      case "operator":
        add(tok.text, OPERATOR_GLOSS[tok.text] ?? "shell control operator", ti, "structure");
        info = null;
        cmdName = null;
        expectCommand = true;
        sawSubcommand = false;
        currentSub = null;
        operandCount = 0;
        pendingValueFor = null;
        nestedArmed = false;
        inNested = false;
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
        cmdName = tok.text;
        add(
          tok.text,
          info ? info.summary : `run the "${tok.text}" program`,
          ti,
          info ? (DB[tok.text] ? "db" : "man") : "structure",
        );
        expectCommand = false;
        sawSubcommand = false;
        currentSub = null;
        operandCount = 0;
        nestedArmed = tok.text === "xargs"; // xargs runs the command that follows
        inNested = false;
        break;
      case "subshell":
        add(tok.text, "run this inner command first and substitute its output", ti, "structure");
        break;
      case "longFlag": {
        const key = tok.text.split("=")[0];
        const hasInlineValue = tok.text.includes("=");
        const dbGloss = flagGloss(info, key);
        const gloss = dbGloss ?? GENERIC_FLAGS[key] ?? "a command option";
        add(tok.text, gloss, ti, dbGloss ? "db" : GENERIC_FLAGS[key] ? "generic" : "structure");
        if (!hasInlineValue && takesValue(info, key)) pendingValueFor = tok.text;
        break;
      }
      case "shortFlag": {
        // 0) kill/killall signal name flag: -KILL, -HUP, -SIGTERM …
        if (cmdName === "kill" || cmdName === "killall" || cmdName === "pkill") {
          const sig = killSignalGloss(tok.text);
          if (sig) {
            add(tok.text, sig, ti, "db");
            break;
          }
        }
        // 1) whole-token match (find-style: -name, -mtime, -delete)
        const whole = flagGloss(info, tok.text);
        if (whole) {
          add(tok.text, whole, ti, "db");
          if (cmdName === "find" && EXEC_FLAGS.has(tok.text)) nestedArmed = true;
          else if (takesValue(info, tok.text)) pendingValueFor = tok.text;
          break;
        }
        const body = tok.text.replace(/^-/, "");
        const letters = body.split("");
        const known = (l: string) => flagGloss(info, l) ?? GENERIC_FLAGS[l];
        // 2) combined short flags (-xzvf) only if every letter is known
        if (letters.length > 1 && letters.every((l) => known(l) !== undefined)) {
          for (const l of letters) {
            add("-" + l, known(l)!, ti, flagGloss(info, l) ? "db" : "generic");
          }
          // if the LAST letter takes a value, the next operand is that value
          const last = letters[letters.length - 1];
          if (takesValue(info, last)) pendingValueFor = "-" + last;
          break;
        }
        // 3) numeric-ish or single/attached short flag: look up first letter
        const first = body.slice(0, 1);
        const gloss = known(first) ?? "a command option";
        add(tok.text, gloss, ti, flagGloss(info, first) ? "db" : GENERIC_FLAGS[first] ? "generic" : "structure");
        // a single short flag with no attached value that expects one
        if (body.length === 1 && takesValue(info, first)) pendingValueFor = tok.text;
        break;
      }
      case "operand": {
        // a) the value for a preceding flag (e.g. curl -o out.html)
        if (pendingValueFor) {
          add(tok.text, `value for ${pendingValueFor}`, ti, "structure");
          pendingValueFor = null;
          operandCount++;
          break;
        }
        // a1) nested-command placeholders / terminators (find -exec, xargs -I)
        if (inNested || nestedArmed) {
          if (tok.text === "{}") {
            add(tok.text, "placeholder — each matched item is substituted here", ti, "db");
            operandCount++;
            break;
          }
          if (tok.text === "\\;" || tok.text === ";") {
            add(tok.text, "end of the -exec command (one run per match)", ti, "structure");
            inNested = false;
            break;
          }
          if (tok.text === "+") {
            add(tok.text, "end of -exec: run once with all matches appended", ti, "structure");
            inNested = false;
            break;
          }
        }
        // a2) start of a nested command that find/xargs runs (grep, rm, …)
        if (nestedArmed && !tok.text.startsWith("-")) {
          enterNested(tok.text, ti, cmdName === "xargs" ? "run per input item" : "run on each match");
          break;
        }
        // a3) a dash-prefixed flag that parsed as an operand (e.g. xargs -0)
        if (tok.text.startsWith("-")) {
          const stripped = tok.text.replace(/^-+/, "");
          const g = flagGloss(info, stripped);
          if (g) {
            add(tok.text, g, ti, "db");
            if (takesValue(info, stripped)) pendingValueFor = tok.text;
            operandCount++;
            break;
          }
        }
        // a4) an inline variable assignment after the command (export FOO=bar, make X=1)
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok.text)) {
          const name = tok.text.split("=")[0];
          add(tok.text, `set ${name} for this command`, ti, "structure");
          operandCount++;
          break;
        }
        // b) a subcommand (git commit, docker run, kubectl get)
        if (info?.subcommands && !sawSubcommand && info.subcommands[tok.text]) {
          add(tok.text, info.subcommands[tok.text], ti, "db");
          sawSubcommand = true;
          currentSub = tok.text;
          break;
        }
        // b1) a second-level subcommand (docker compose up, git stash pop)
        if (
          sawSubcommand &&
          currentSub &&
          operandCount === 0 &&
          info?.subSubcommands?.[currentSub]?.[tok.text]
        ) {
          add(tok.text, info.subSubcommands[currentSub][tok.text], ti, "db");
          break;
        }
        // b2) a leading bare flag cluster (tar czf, ps aux) — no dash, all known.
        if (
          info?.bareFlags &&
          operandCount === 0 &&
          !sawSubcommand &&
          /^[A-Za-z]{2,}$/.test(tok.text) &&
          tok.text.split("").every((l) => info!.flags[l] !== undefined)
        ) {
          const letters = tok.text.split("");
          for (const l of letters) add(l, info.flags[l], ti, "db");
          const last = letters[letters.length - 1];
          if (takesValue(info, last)) pendingValueFor = last;
          operandCount++;
          break;
        }
        // b3) an interpreter "program": sed script (s/a/b/g) or awk program.
        if (cmdName === "sed") {
          const g = sedGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        if (cmdName === "awk") {
          const g = awkGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        if (cmdName === "jq") {
          const g = jqGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        // b4) chmod mode (octal 755 / 4755 or symbolic u+x,go-w) — the first operand.
        if (cmdName === "chmod" && operandCount === 0) {
          const g = chmodModeGloss(tok.text);
          if (g) {
            add(tok.text, g, ti, "db");
            operandCount++;
            break;
          }
        }
        // b5) kill/killall signal as an operand (-9 parses as an operand) + PIDs.
        if (cmdName === "kill" || cmdName === "killall" || cmdName === "pkill") {
          const sig = killSignalGloss(tok.text);
          if (sig) {
            add(tok.text, sig, ti, "db");
            operandCount++;
            break;
          }
          if (cmdName === "kill" && /^%?\d+$/.test(tok.text)) {
            add(
              tok.text,
              tok.text.startsWith("%")
                ? `job ${tok.text} to signal`
                : "process ID (PID) to signal",
              ti,
              "structure",
            );
            operandCount++;
            break;
          }
        }
        // c) a whole-token flag used as an operand (find -delete style)
        if (info?.flags[tok.text]) {
          add(tok.text, info.flags[tok.text], ti, "db");
        } else if (/^-\d+$/.test(tok.text)) {
          add(tok.text, "a numeric option (often a count or limit)", ti, "structure");
        } else {
          add(tok.text, "an argument passed to the command", ti, "structure");
        }
        operandCount++;
        break;
      }
    }
  });

  return { raw, parsed, lines };
}

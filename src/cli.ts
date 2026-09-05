#!/usr/bin/env node
// cmdxray — CLI entry point.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { explain } from "./explain.js";
import { renderTerminal, renderSvg, renderHtml } from "./card.js";
import type { CommandInfo } from "./db.js";

const PLAYGROUND = "https://aurelio-nakamura.github.io/cmdxray/";

const HELP = `cmdxray — x-ray any shell command, offline.

Usage:
  cmdxray <command...>            explain a command in your terminal
  cmdxray --svg <command...>      emit a shareable SVG card to stdout
  cmdxray --html <command...>     emit a standalone HTML page to stdout
  cmdxray -o card.svg <command>   write the SVG card to a file
  cmdxray --share <command...>    print a shareable link to the breakdown
  echo "<cmd>" | cmdxray          read the command from stdin

Options:
  --svg        output an SVG card
  --html       output a standalone HTML page
  -o <file>    write output to <file> (format inferred from extension)
  --share      also print a shareable playground link for the command
  --link       print ONLY the shareable playground link (no explanation)
  --no-color   disable ANSI colors in terminal output
  --no-man     do not consult local man pages for unknown commands
  -h, --help   show this help

Everything runs locally. Nothing is uploaded.`;

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

function main() {
  const argv = process.argv.slice(2);
  let format: "term" | "svg" | "html" = "term";
  let outFile: string | null = null;
  let color: boolean = true;
  let useMan: boolean = true;
  let share: boolean = false;
  let linkOnly: boolean = false;
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
    a === "--svg" || a === "--html" || a === "--no-color" || a === "--no-man" ||
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
    const content = isHtml ? renderHtml(res) : renderSvg(res);
    writeFileSync(outFile, content);
    console.error(`cmdxray: wrote ${outFile}`);
    return;
  }

  if (format === "svg") process.stdout.write(renderSvg(res) + "\n");
  else if (format === "html") process.stdout.write(renderHtml(res) + "\n");
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

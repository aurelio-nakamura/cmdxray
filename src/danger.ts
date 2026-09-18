// cmdxray — risk analysis.
// Inspects a parsed command for destructive / dangerous patterns and returns
// plain-English warnings. Pure & dependency-free. High-precision by design:
// every rule targets a genuinely risky construct so the warnings stay
// trustworthy (a noisy linter that cries wolf is worse than none).

import { ParsedCommand, Segment, Token } from "./parse.js";

export type RiskLevel = "danger" | "caution";

export interface Warning {
  level: RiskLevel;
  title: string; // short label, e.g. "Recursive force-delete"
  detail: string; // one plain-English sentence on why it is risky
}

const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish", "ash"]);
const DOWNLOADERS = new Set(["curl", "wget", "fetch"]);
const DEVICE_RE = /^\/dev\/(sd[a-z]|nvme\d|hd[a-z]|vd[a-z]|disk\d|mmcblk\d)/;
// A path that overwriting or truncating would break the running system.
const SYSTEM_FILE_RE =
  /^\/(etc\/(passwd|shadow|group|gshadow|fstab|hosts|sudoers|resolv\.conf|crontab)|boot\/|etc\/?$)/;
// An operand that points at a system-critical root the caller almost never
// means to recurse over destructively.
const SYSTEM_ROOT_RE =
  /^\/$|^\/\*$|^~\/?$|^\$HOME\/?$|^\/(bin|sbin|etc|usr|var|boot|lib|lib64|home|root|dev|sys|proc)\/?\*?$/;

// The flags active on a segment, expanded so combined short flags (-rf) count
// as individual flags (-r, -f) and long flags drop any =value.
function flagsOf(seg: Segment): Set<string> {
  const s = new Set<string>();
  for (const tok of seg.tokens) {
    if (tok.kind === "shortFlag") {
      if (tok.bundle) for (const l of tok.bundle) s.add("-" + l);
      else s.add(tok.text.replace(/=.*/, ""));
    } else if (tok.kind === "longFlag") {
      s.add(tok.text.replace(/=.*/, ""));
    }
  }
  return s;
}

function operandsOf(seg: Segment): string[] {
  return seg.tokens.filter((t) => t.kind === "operand").map((t) => t.text);
}

// The command a segment really runs, seeing through a leading `sudo`/`env`.
function effectiveCommand(seg: Segment): string | null {
  if (seg.command !== "sudo" && seg.command !== "env") return seg.command;
  const ops = operandsOf(seg);
  return ops.length ? ops[0].replace(/.*\//, "") : seg.command;
}

// Does this segment ultimately invoke a shell interpreter?
function runsShell(seg: Segment): boolean {
  const base = (seg.command ?? "").replace(/.*\//, "");
  if (SHELLS.has(base)) return true;
  if (base === "sudo" || base === "env") {
    for (const op of operandsOf(seg)) {
      if (SHELLS.has(op.replace(/.*\//, ""))) return true;
    }
  }
  return false;
}

// Walk the flat token stream to learn what separator (pipe / && / ; …) precedes
// each simple command, so we can tell `curl x | bash` (piped) apart from
// `curl x ; bash` (sequential) or `curl x && bash` (conditional).
function precedingSeparators(parsed: ParsedCommand): (string | null)[] {
  const seps: (string | null)[] = [];
  let pending: string | null = null;
  let seenCommandInSeg = false;
  for (const tok of parsed.tokens) {
    if (tok.kind === "pipe" || tok.kind === "operator") {
      pending = tok.text;
      seenCommandInSeg = false;
      continue;
    }
    if (tok.kind === "command" && !seenCommandInSeg) {
      seps.push(pending);
      pending = null;
      seenCommandInSeg = true;
    }
  }
  return seps;
}

export function analyzeDangers(parsed: ParsedCommand): Warning[] {
  const warnings: Warning[] = [];
  const seen = new Set<string>();
  const add = (w: Warning) => {
    const key = w.level + "|" + w.title;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(w);
  };

  const raw = parsed.raw;

  // --- fork bomb: :(){ :|:& };:  (and obfuscated spacings) ---
  if (/\b\w+\s*\(\)\s*\{\s*[^}]*\|\s*\w+\s*&\s*[^}]*\}\s*;/.test(raw) || /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/.test(raw.replace(/\s+/g, ""))) {
    add({
      level: "danger",
      title: "Fork bomb",
      detail: "Recursively spawns processes until the machine runs out of resources and hangs.",
    });
  }

  // --- CI/CD template-expression injection: ${{ … }} spliced into a command ---
  // In GitHub Actions (and similar CI), a ${{ … }} expression is substituted into
  // the `run:` script by the runner BEFORE the shell parses it. When the value is
  // attacker-controllable (a PR/issue title or body, a branch name, a commit
  // message…), a crafted value like `"; rm -rf / #` breaks out of its context and
  // runs as code. The only safe pattern is to pass the value through an
  // environment variable and reference it quoted ("$VAR"), so a ${{ … }} inlined
  // directly into a command is a genuine injection vector.
  {
    const exprRe = /\$\{\{\s*([^}]*?)\s*\}\}/g;
    // Expression sources an external actor can control the text of.
    const UNTRUSTED =
      /github\.head_ref|github\.event\.(issue|pull_request|discussion)\.(title|body)|github\.event\.pull_request\.head\.(ref|label)|github\.event\.pull_request\.head\.repo\.(default_branch|description|homepage)|github\.event\.comment\.body|github\.event\.review(_comment)?\.body|github\.event\.commits|github\.event\.head_commit\.(message|author)|github\.event\.pages|github\.event\.workflow_run\.(head_branch|display_title)/;
    let m: RegExpExecArray | null;
    let sawExpr = false;
    let sawUntrusted = false;
    while ((m = exprRe.exec(raw)) !== null) {
      sawExpr = true;
      if (UNTRUSTED.test(m[1])) sawUntrusted = true;
    }
    if (sawUntrusted) {
      add({
        level: "danger",
        title: "CI expression injection",
        detail:
          "A ${{ … }} expression that can carry attacker-controlled text (a PR/issue title or body, branch name, or commit message) is spliced into this command before the shell runs it — a crafted value can inject arbitrary commands. Pass it through an environment variable and quote it (\"$VAR\") instead of inlining it.",
      });
    } else if (sawExpr) {
      add({
        level: "caution",
        title: "CI expression interpolation",
        detail:
          "A ${{ … }} template expression is substituted into this command by the CI runner before the shell parses it. If its value is user-influenced, pass it via an environment variable referenced as \"$VAR\" rather than inlining it, to avoid shell injection.",
      });
    }
  }

  const seps = precedingSeparators(parsed);
  const commandSegs = parsed.segments.filter((s) => s.command);

  // --- pipe a download straight into a shell: curl … | bash ---
  let sawDownloader = false;
  commandSegs.forEach((seg, i) => {
    const base = (seg.command ?? "").replace(/.*\//, "");
    if (DOWNLOADERS.has(base)) sawDownloader = true;
    else if (sawDownloader && runsShell(seg) && seps[i] === "|") {
      add({
        level: "danger",
        title: "Runs downloaded code unread",
        detail: "Pipes a file fetched from the network straight into a shell — you execute whatever the server sends, sight unseen.",
      });
    }
  });

  for (const seg of parsed.segments) {
    const base = (seg.command ?? "").replace(/.*\//, "");
    const eff = (effectiveCommand(seg) ?? "").replace(/.*\//, "");
    const flags = flagsOf(seg);
    const ops = operandsOf(seg);

    // --- sudo: elevated privileges ---
    if (base === "sudo") {
      add({
        level: "caution",
        title: "Runs as root",
        detail: "Executes with superuser privileges — a mistake here can affect the whole system.",
      });
    }

    // --- rm: recursive / forced deletion ---
    if (eff === "rm") {
      const recursive = flags.has("-r") || flags.has("-R") || flags.has("--recursive");
      const force = flags.has("-f") || flags.has("--force");
      const noPreserve = flags.has("--no-preserve-root");
      const targets = ops.filter((o) => o !== "sudo" && o !== "rm");
      const hitsRoot = targets.some((t) =>
        /^\/$|^\/\*|^~\/?$|^\$HOME\/?$|^\/(bin|etc|usr|var|boot|lib|home|root|dev|sys|proc)\b/.test(t) || t === "*" || t === "." || t === ".." || t === "./*",
      );
      if (noPreserve) {
        add({
          level: "danger",
          title: "Disables the / safety guard",
          detail: "--no-preserve-root removes the check that normally stops rm from wiping the entire root filesystem.",
        });
      }
      if (recursive && force) {
        add({
          level: "danger",
          title: hitsRoot ? "Wipes critical paths, no prompt" : "Recursive force-delete",
          detail: hitsRoot
            ? "Recursively force-deletes system-critical paths with no confirmation and no recovery."
            : "Recursively deletes directories without any confirmation — there is no undo and no trash.",
        });
      } else if (recursive) {
        add({ level: "caution", title: "Recursive delete", detail: "Deletes whole directory trees — double-check the target path." });
      } else if (force) {
        add({ level: "caution", title: "Forced delete", detail: "Deletes without prompting, even for write-protected files." });
      }
    }

    // --- dd: raw device write ---
    if (eff === "dd") {
      const toDevice = ops.some((o) => /^of=\/dev\//.test(o));
      if (toDevice) {
        add({
          level: "danger",
          title: "Raw write to a disk device",
          detail: "dd writes bytes directly to a device (of=/dev/…), overwriting everything on that disk with no confirmation.",
        });
      }
    }

    // --- mkfs: format a filesystem ---
    if (/^mkfs(\.|$)/.test(eff)) {
      add({ level: "danger", title: "Formats a filesystem", detail: "Creates a new filesystem on the target, erasing all data currently on it." });
    }

    // --- chmod 777 / world-writable ---
    if (eff === "chmod") {
      const world = ops.some((o) => /(^|=)7?77$|^0?777$/.test(o) || /[ugoa]*\+.*w/.test(o) && /o/.test(o));
      const perm777 = ops.some((o) => /^0?777$/.test(o));
      if (perm777 || world) {
        const recursive = flags.has("-R") || flags.has("--recursive");
        add({
          level: "caution",
          title: recursive ? "World-writable, recursively" : "World-writable permissions",
          detail: "Grants read/write/execute to every user on the machine — a common security misconfiguration.",
        });
      }
    }

    // --- chown -R: recursive ownership change ---
    if (eff === "chown" && (flags.has("-R") || flags.has("--recursive"))) {
      const hitsRoot = ops.some((o) => SYSTEM_ROOT_RE.test(o));
      add({
        level: hitsRoot ? "danger" : "caution",
        title: hitsRoot ? "Recursive chown of a system path" : "Recursive ownership change",
        detail: hitsRoot
          ? "Recursively rewrites ownership across a system-critical path — this breaks sudo, ssh and login and can lock everyone out of the machine."
          : "Reassigns ownership of an entire tree — easy to lock yourself out of files if the path is wrong.",
      });
    }

    // --- chmod -R on a system path: locks the system out of its own files ---
    if (eff === "chmod" && (flags.has("-R") || flags.has("--recursive"))) {
      const hitsRoot = ops.some((o) => SYSTEM_ROOT_RE.test(o));
      if (hitsRoot) {
        add({
          level: "danger",
          title: "Recursive chmod of a system path",
          detail: "Recursively rewrites permissions across a system-critical path — stripping or over-granting bits here breaks sudo/ssh/boot and can render the machine unusable.",
        });
      }
    }

    // --- disk destroyers: shred / wipefs / blkdiscard on a whole device ---
    if (eff === "shred" || eff === "wipefs" || eff === "blkdiscard") {
      const toDevice = ops.some((o) => DEVICE_RE.test(o));
      if (toDevice) {
        add({
          level: "danger",
          title: "Destroys a disk device",
          detail: `${eff} operates directly on a raw device — it irreversibly erases the partition table and/or every byte on that disk.`,
        });
      }
    }

    // --- kill/pkill targeting every process or PID 1 (init) ---
    if (eff === "kill" || eff === "killall5") {
      // `kill -9 -1` / `kill -1` (PID -1 = every process the user can signal),
      // or signalling PID 1 (init/systemd) which can wedge the system.
      const targetsAll = eff === "killall5" || ops.some((o) => o === "-1") ||
        (seg.tokens.some((t) => t.kind === "operand" && t.text === "1") &&
          (flags.has("-9") || flags.has("-KILL") || ops.includes("-KILL")));
      const hitsInit = ops.includes("1");
      if (targetsAll) {
        add({
          level: "danger",
          title: "Signals every process / init",
          detail: "Sends a signal to PID 1 or to every process the user owns (-1) — this can kill your session or bring the whole system down.",
        });
      } else if (hitsInit) {
        add({
          level: "caution",
          title: "Signals PID 1 (init)",
          detail: "PID 1 is the init/systemd process; signalling it can destabilise or halt the system.",
        });
      }
    }

    // --- find … -delete: mass deletion with no prompt ---
    if (eff === "find") {
      const hasDelete = seg.tokens.some((t) => t.text === "-delete");
      const execRm =
        seg.tokens.some((t) => t.text === "-exec" || t.text === "-execdir") &&
        seg.tokens.some((t) => t.text === "rm");
      if (hasDelete || execRm) {
        const hitsRoot = ops.some((o) => SYSTEM_ROOT_RE.test(o) || o === "/");
        add({
          level: hitsRoot ? "danger" : "caution",
          title: hitsRoot ? "Mass-deletes from a system path" : "Deletes every match, no prompt",
          detail: hitsRoot
            ? "find … -delete (or -exec rm) walks a system-critical path and removes everything it matches, with no confirmation and no undo."
            : "find removes every file it matches with no confirmation — a too-broad pattern deletes far more than intended.",
        });
      }
    }

    // --- crontab -r: wipes all scheduled jobs (a keystroke away from -e) ---
    if (eff === "crontab" && (flags.has("-r") || ops.includes("-r"))) {
      add({
        level: "caution",
        title: "Removes all cron jobs",
        detail: "crontab -r deletes the user's entire crontab with no confirmation — and sits right next to -e on the keyboard.",
      });
    }

    // --- git: history / data-losing operations ---
    if (eff === "git") {
      const sub = ops[0];
      if (sub === "push" && (flags.has("-f") || flags.has("--force") || flags.has("--force-with-lease"))) {
        add({ level: "caution", title: "Force-push", detail: "Overwrites the remote branch history — can destroy commits other people rely on." });
      }
      if (sub === "reset" && flags.has("--hard")) {
        add({ level: "caution", title: "Hard reset", detail: "Discards all uncommitted changes in the working tree — they cannot be recovered." });
      }
      if (sub === "clean" && (flags.has("-f") || flags.has("--force"))) {
        add({ level: "caution", title: "Deletes untracked files", detail: "git clean permanently removes untracked files and directories." });
      }
    }

    // --- power state ---
    if (["shutdown", "reboot", "halt", "poweroff"].includes(eff)) {
      add({ level: "caution", title: "Changes machine power state", detail: "Shuts down or restarts the system — active sessions and unsaved work are lost." });
    }

    // --- eval of a constructed string ---
    if (eff === "eval") {
      add({ level: "caution", title: "Evaluates a built string", detail: "Runs an assembled string as a command — dangerous if any part comes from untrusted input." });
    }

    // --- redirect onto a device or truncating overwrite ---
    const toks = seg.tokens;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.kind === "redirect" && (t.text === ">" || t.text === ">>" || t.text === "&>")) {
        const target = toks[i + 1]?.text ?? "";
        if (DEVICE_RE.test(target)) {
          add({ level: "danger", title: "Writes onto a disk device", detail: `Redirects output straight to ${target}, corrupting whatever is stored there.` });
        } else if ((t.text === ">" || t.text === "&>") && SYSTEM_FILE_RE.test(target)) {
          add({
            level: "danger",
            title: "Truncates a critical system file",
            detail: `A single '>' onto ${target} empties it before anything is written — blanking this file can lock out logins or break booting.`,
          });
        }
      }
    }
  }

  return warnings;
}

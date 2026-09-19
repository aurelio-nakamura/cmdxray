// cmdxray — check + guard.
//
// `cmdxray check <command>` is a fast, script-friendly risk check: it runs the
// SAME offline danger engine the explainer/lint/MCP safety-gate use and encodes
// the verdict in its EXIT CODE (0 = no danger, 1 = risky) so it composes in
// shell:  `cmdxray check "$cmd" && eval "$cmd"`.
//
// `cmdxray guard bash` prints a shell snippet you can add to ~/.bashrc:
//     eval "$(cmdxray guard bash)"
// It hooks bash's pre-execution DEBUG trap so that, right before you run a
// command the danger engine flags as destructive (rm -rf /, curl | sudo bash,
// dd/mkfs/shred to a device, git push --force, a fork bomb, …), your shell
// STOPS and asks for confirmation. It is deliberately FAIL-OPEN: if cmdxray is
// missing or anything errors, your command runs normally — the guard can only
// ever ADD a confirmation prompt on genuinely-dangerous lines, never break your
// shell or block ordinary work.

import { explain, ExplainOptions } from "./explain.js";
import type { RiskLevel } from "./danger.js";

export interface CheckReport {
  command: string;
  risk: RiskLevel | "none";
  warnings: { level: RiskLevel; title: string; detail: string }[];
}

// Run the danger engine over a single command line and summarize the verdict.
export function checkCommand(command: string, opts: ExplainOptions = {}): CheckReport {
  let warnings: CheckReport["warnings"] = [];
  try {
    warnings = explain(command, opts).warnings.map((w) => ({
      level: w.level,
      title: w.title,
      detail: w.detail,
    }));
  } catch {
    warnings = [];
  }
  const risk: CheckReport["risk"] = warnings.some((w) => w.level === "danger")
    ? "danger"
    : warnings.some((w) => w.level === "caution")
      ? "caution"
      : "none";
  return { command, risk, warnings };
}

// The bash guard snippet. `bin` is the command used to invoke cmdxray inside the
// hook (default "cmdxray"); overridable at eval time via $CMDXRAY_GUARD_BIN.
export function bashGuardScript(): string {
  // In a String.raw literal, backslashes are kept verbatim (good — bash needs
  // them) but `${...}` is still JS interpolation, so emit a literal `$` via D
  // wherever bash needs a `${...}` parameter expansion.
  const D = "$";
  return String.raw`# cmdxray guard (bash) — confirm before running a dangerous command.
# Install:  add  eval "$(cmdxray guard bash)"  to your ~/.bashrc
# Fail-open: if cmdxray is missing or errors, your command runs normally.
# Uninstall: remove that line (or run  trap - DEBUG  in the current shell).
__cmdxray_guard_bin="${D}{CMDXRAY_GUARD_BIN:-cmdxray}"
__cmdxray_guard() {
  # Only vet top-level, interactive commands typed at the prompt — never
  # commands run inside functions, PROMPT_COMMAND, completion, or subshells.
  case $- in *i*) ;; *) return 0 ;; esac
  [ "${D}{#FUNCNAME[@]}" -gt 1 ] && return 0
  [ "${D}{BASH_SUBSHELL:-0}" -ne 0 ] && return 0
  [ -n "${D}{COMP_LINE:-}" ] && return 0
  local __cmd="$BASH_COMMAND"
  [ -z "$__cmd" ] && return 0
  [ "$__cmd" = "${D}{PROMPT_COMMAND:-}" ] && return 0
  # Cheap pure-shell pre-filter: skip the cmdxray call unless the line even
  # mentions something potentially destructive. Ordinary commands pay $0 cost.
  case "$__cmd" in
    *rm\ *|*rmdir\ *|*dd\ *|*mkfs*|*shred\ *|*wipefs*|*blkdiscard*|*fdisk*|\
    *chmod\ *|*chown\ *|*chattr*|*curl*|*wget*|*'|'*|*'>'*|*mv\ *|*kill*|\
    *killall*|*find\ *|*git\ *|*crontab*|*eval\ *|*truncate*|*:\(\)*|*fork*|\
    *mkswap*|*parted*|*sfdisk*|*'/dev/sd'*|*'/dev/nvme'*|*no-preserve-root*) ;;
    *) return 0 ;;
  esac
  # Fail-open risk check: only a clean exit code of 1 (danger) triggers the gate.
  local __out __rc
  __out="$("$__cmdxray_guard_bin" check --quiet --no-color -- "$__cmd" 2>/dev/null)"
  __rc=$?
  [ "$__rc" -eq 1 ] || return 0
  {
    printf '\n\033[1;31m⚠  cmdxray: this command looks dangerous\033[0m\n'
    printf '%s\n' "$__out"
  } >&2
  local __ans=""
  if [ -r /dev/tty ]; then
    read -r -p $'\033[1mRun it anyway? [y/N] \033[0m' __ans </dev/tty 2>/dev/null || { printf '\n' >&2; return 1; }
  else
    return 0  # no controlling terminal to confirm on → don't block scripts
  fi
  case "$__ans" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) printf '\033[2mcmdxray: cancelled — command not run.\033[0m\n' >&2; return 1 ;;
  esac
}
shopt -s extdebug
trap '__cmdxray_guard' DEBUG
`;
}

// A friendly message emitted for shells we don't yet ship a guard for.
export function unsupportedShellMessage(shell: string): string {
  return `# cmdxray guard: no built-in guard for "${shell}" yet (bash is supported).
# For now, in ${shell} you can gate a command manually with the exit-code check:
#     cmdxray check "<command>" && eval "<command>"
# A ${shell} guard is welcome as a contribution:
#     https://github.com/aurelio-nakamura/cmdxray
`;
}

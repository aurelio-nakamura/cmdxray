// cmdxray — batch mode.
// Explains many commands in a single process. Reads a JSON array of commands
// and returns a JSON array of reports — so a high-throughput scanner can x-ray
// thousands of embedded shell snippets without paying the Node startup cost per
// command. Requested in issue #3 (GitGalaxy CI/CD scanning integration).

import { explain, ExplainOptions } from "./explain.js";
import { toJsonReport, JsonReport } from "./json.js";

export interface BatchError {
  command: string | null;
  error: string; // why this single item could not be analyzed
}

// One entry per input command: either a full JSON report or a per-item error.
// A single malformed command never aborts the whole batch.
export type BatchEntry = JsonReport | BatchError;

// Accepts a bare command string or a { command: string } object per element,
// so callers can carry their own metadata alongside each command if they wish.
function commandOf(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && typeof (item as { command?: unknown }).command === "string") {
    return (item as { command: string }).command;
  }
  return null;
}

// Parse the batch input (a JSON array) and analyze each command. Throws only on
// a structurally invalid batch (not valid JSON / not an array); individual
// command failures are captured as BatchError entries so the array stays aligned
// 1:1 with the input.
export function runBatch(input: string, opts: ExplainOptions = {}): BatchEntry[] {
  let arr: unknown;
  try {
    arr = JSON.parse(input);
  } catch (e) {
    throw new Error("cmdxray --batch-json: stdin is not valid JSON — expected a JSON array of command strings. " + (e as Error).message);
  }
  if (!Array.isArray(arr)) {
    throw new Error("cmdxray --batch-json: expected a JSON array of command strings on stdin, got " + (arr === null ? "null" : typeof arr) + ".");
  }
  return arr.map((item): BatchEntry => {
    const command = commandOf(item);
    if (command == null) {
      return { command: null, error: "each item must be a command string, or an object with a string `command` field" };
    }
    try {
      return toJsonReport(explain(command.trim(), opts));
    } catch (e) {
      return { command, error: (e as Error).message };
    }
  });
}

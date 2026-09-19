#!/usr/bin/env node
/**
 * cmdxray MCP server (stdio) — zero-dependency.
 *
 * Exposes cmdxray's offline shell-command intelligence to any MCP client
 * (Claude Desktop, Cursor, Cline, VS Code, Windsurf, ...). The stand-out tool
 * is `check_command_safety`: before an AI agent runs a shell command it just
 * generated, it can ask cmdxray whether that command is destructive
 * (rm -rf /, curl | sudo bash, dd/mkfs/shred to a disk device, chmod -R 777 /,
 * truncating /etc/passwd, fork bombs, ...) and get a plain-English verdict — a
 * safety gate for agentic shell execution. `lint_script` extends this to a whole
 * multi-line script, flagging every risky line before it is written or run.
 *
 * Everything runs locally and offline: no network, no upload, and (true to
 * cmdxray) no third-party dependencies. It speaks MCP over newline-delimited
 * JSON-RPC 2.0 on stdin/stdout.
 */
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { explain } from "./explain.js";
import { toJsonReport, type JsonReport } from "./json.js";
import { lintText, type LintFinding } from "./lint.js";

const require = createRequire(import.meta.url);
let VERSION = "0.0.0";
try {
  VERSION = (require("../package.json") as { version: string }).version;
} catch {
  /* version is best-effort */
}
const SERVER_NAME = "cmdxray";
// Echoed back to the client if it doesn't request a protocol version.
const DEFAULT_PROTOCOL = "2025-06-18";

// --- tool implementations -------------------------------------------------

function riskEmoji(risk: string): string {
  return risk === "danger" ? "🛑" : risk === "caution" ? "⚠️" : "✅";
}

function explainToMarkdown(report: JsonReport): string {
  const out: string[] = [];
  out.push(`# cmdxray — \`${report.command}\``);
  out.push("");
  out.push(`**Risk:** ${riskEmoji(report.risk)} ${report.risk}`);
  out.push("");
  if (report.explanations.length) {
    out.push("## Breakdown");
    for (const e of report.explanations) out.push(`- \`${e.token}\` — ${e.gloss}`);
    out.push("");
  }
  if (report.warnings.length) {
    out.push("## Risk warnings");
    for (const w of report.warnings) {
      out.push(`- ${w.level === "danger" ? "🛑" : "⚠️"} **${w.title}** — ${w.detail}`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd();
}

function safetyToMarkdown(report: JsonReport): string {
  const out: string[] = [];
  out.push(`Command: \`${report.command}\``);
  out.push(
    report.risk === "danger"
      ? "🛑 DANGER — this command can destroy data or break the system. Do NOT run it without explicit human confirmation."
      : report.risk === "caution"
        ? "⚠️ CAUTION — this command has risky effects; review it before running."
        : "✅ No known destructive patterns detected. (Absence of a warning is not a guarantee — still review anything you don't fully understand.)",
  );
  if (report.warnings.length) {
    out.push("");
    for (const w of report.warnings) {
      out.push(`- ${w.level === "danger" ? "🛑" : "⚠️"} ${w.title}: ${w.detail}`);
    }
  }
  return out.join("\n");
}

function scriptToMarkdown(findings: LintFinding[]): string {
  const danger = findings.filter((f) => f.level === "danger").length;
  const caution = findings.filter((f) => f.level === "caution").length;
  const out: string[] = [];
  if (findings.length === 0) {
    out.push(
      "✅ No known destructive patterns detected in this script. (Absence of a warning is not a guarantee — still review anything you don't fully understand.)",
    );
    return out.join("\n");
  }
  out.push(
    danger
      ? `🛑 DANGER — this script contains ${danger} destructive command(s)${caution ? ` and ${caution} risky one(s)` : ""}. Do NOT run it without explicit human review.`
      : `⚠️ CAUTION — this script contains ${caution} risky command(s); review before running.`,
  );
  out.push("");
  for (const f of findings) {
    out.push(`- line ${f.line} ${f.level === "danger" ? "🛑" : "⚠️"} ${f.title}: \`${f.command}\` — ${f.detail}`);
  }
  return out.join("\n");
}

const TOOLS = [
  {
    name: "explain_command",
    description:
      "Explain any shell command offline: a plain-English, token-by-token breakdown of the program, its flags and operands — including pipes, redirects, subshells and common inline languages (sed/awk/jq) — plus a risk assessment. Use it to understand what a command line does before running or recommending it.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: 'The shell command line to explain, e.g. "tar -xzvf archive.tar.gz".',
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
  {
    name: "check_command_safety",
    description:
      "Safety-check a shell command BEFORE executing it. Returns a risk verdict (danger / caution / none) and plain-English warnings for destructive patterns: rm -rf /, curl | sudo bash, dd/mkfs/shred/wipefs to a disk device, chmod -R 777 /, git push --force, truncating /etc/passwd, fork bombs, kill -9 -1, find / -delete, and more. Ideal as a guard an AI agent calls before running shell commands.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command line to safety-check.",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
  {
    name: "lint_script",
    description:
      "Safety-scan a WHOLE shell script (multi-line text) BEFORE writing or running it. Runs the same offline danger engine as check_command_safety over every logical line (comments/shebangs stripped, backslash-continuations joined) and returns each destructive or risky command with its line number: rm -rf /, curl | sudo bash, dd/mkfs/shred to a device, chmod -R 777 /, git push --force, CI ${{ }}-injection sinks, and more. Ideal for an AI agent to pre-scan a script it just generated before saving or executing it.",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "The full shell-script text to scan (may contain many lines).",
        },
      },
      required: ["script"],
      additionalProperties: false,
    },
  },
];

interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

function callTool(name: string, args: Record<string, unknown>): ToolResult {
  if (name === "lint_script") {
    const script = typeof args.script === "string" ? args.script : "";
    if (!script.trim()) {
      return {
        content: [{ type: "text", text: "Error: `script` (a non-empty string) is required." }],
        isError: true,
      };
    }
    const findings = lintText(script, "<script>");
    return {
      content: [{ type: "text", text: scriptToMarkdown(findings) }],
      structuredContent: {
        risk: findings.some((f) => f.level === "danger")
          ? "danger"
          : findings.some((f) => f.level === "caution")
            ? "caution"
            : "none",
        danger: findings.filter((f) => f.level === "danger").length,
        caution: findings.filter((f) => f.level === "caution").length,
        findings,
      },
    };
  }
  const command = typeof args.command === "string" ? args.command : "";
  if (!command.trim()) {
    return {
      content: [{ type: "text", text: "Error: `command` (a non-empty string) is required." }],
      isError: true,
    };
  }
  const report = toJsonReport(explain(command));
  if (name === "explain_command") {
    return { content: [{ type: "text", text: explainToMarkdown(report) }], structuredContent: report };
  }
  if (name === "check_command_safety") {
    return {
      content: [{ type: "text", text: safetyToMarkdown(report) }],
      structuredContent: { command: report.command, risk: report.risk, warnings: report.warnings },
    };
  }
  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
}

// --- JSON-RPC 2.0 over stdio ---------------------------------------------

interface RpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function send(msg: unknown): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function result(id: string | number, res: unknown): void {
  send({ jsonrpc: "2.0", id, result: res });
}
function rpcError(id: string | number, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function handle(msg: RpcMessage): void {
  const { method, params } = msg;
  const hasId = msg.id !== undefined && msg.id !== null;
  const id = msg.id as string | number;
  switch (method) {
    case "initialize": {
      const clientProto = params?.protocolVersion;
      if (hasId)
        result(id, {
          protocolVersion: typeof clientProto === "string" ? clientProto : DEFAULT_PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: VERSION },
        });
      return;
    }
    case "notifications/initialized":
    case "initialized":
      return; // notification, no response
    case "ping":
      if (hasId) result(id, {});
      return;
    case "tools/list":
      if (hasId) result(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const res = callTool(
        typeof params?.name === "string" ? params.name : "",
        (params?.arguments as Record<string, unknown>) ?? {},
      );
      if (hasId) result(id, res);
      return;
    }
    default:
      if (hasId) rpcError(id, -32601, `Method not found: ${method}`);
      return;
  }
}

function main(): void {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const s = line.trim();
    if (!s) return;
    let msg: RpcMessage;
    try {
      msg = JSON.parse(s) as RpcMessage;
    } catch {
      return; // ignore non-JSON lines
    }
    try {
      handle(msg);
    } catch (e) {
      if (msg.id !== undefined && msg.id !== null) {
        rpcError(msg.id as string | number, -32603, e instanceof Error ? e.message : String(e));
      }
    }
  });
  rl.on("close", () => process.exit(0));
}

main();

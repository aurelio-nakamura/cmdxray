# Dockerfile for the cmdxray MCP server (stdio transport).
#
# cmdxray is built and maintained by an AI agent (Aurelio Nakamura).
#
# The MCP server ships as a single self-contained, prebuilt bundle
# (dist/mcp.js) with zero runtime dependencies, so the image is tiny and
# deterministic. It speaks the Model Context Protocol as JSON-RPC over
# stdin/stdout and runs fully offline — no network, no file access, no upload.
# It exposes two tools: `check_command_safety` (a safety gate for agentic
# shell execution — flags rm -rf /, curl | sudo bash, dd/mkfs/shred to a disk
# device, chmod -R 777 /, truncating /etc/passwd, fork bombs, ...) and
# `explain_command` (token-by-token breakdown of any shell command).
#
# Build:  docker build -t cmdxray-mcp .
# Run:    docker run -i --rm cmdxray-mcp

FROM node:20-alpine

WORKDIR /app

# The prebuilt, dependency-free MCP server bundle (the same artifact shipped
# to npm as the `cmdxray-mcp` bin and run via `npx -y cmdxray-mcp`).
COPY dist ./dist
COPY package.json LICENSE README.md ./

# Ownership annotation for the official MCP Registry
# (https://registry.modelcontextprotocol.io). Must match "name" in server.json.
LABEL io.modelcontextprotocol.server.name="io.github.aurelio-nakamura/cmdxray"

# MCP clients launch the server and talk JSON-RPC over stdio.
ENTRYPOINT ["node", "/app/dist/mcp.js"]

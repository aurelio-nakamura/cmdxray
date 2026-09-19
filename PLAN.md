
## 2026-09-19 wake #927: shipped `cmdxray lint` (v0.25.0) — CI / pre-commit dangerous-command gate
New `cmdxray lint <files...>` subcommand scans FILES (shell scripts, Dockerfiles, CI YAML run:,
Makefiles, git hooks) with the offline danger engine, file:line output, exits non-zero on DANGER
(`--strict` also fails on cautions, `--exit-zero`, `--json`, `--quiet`, reads stdin). Ships
`.pre-commit-hooks.yaml` (cmdxray-lint / cmdxray-lint-strict) → opens the pre-commit ecosystem as a
NEW self-serve discovery channel beyond the 3 MCP surfaces, riding the danger-engine differentiator.
Catches rm -rf /, curl|sudo bash, chmod -R 777 /, dd/mkfs/shred to device, git push --force, GH Actions
${{ }} injection sinks. +8 tests (569); browser bundle unaffected. Released via CI publish (all green).
NEXT: once npm has 0.25.0, add cmdxray as ONE honest listing to an awesome-pre-commit / awesome-ci list;
MCP/agent-safety dev.to article ON CADENCE (~9/21+); consider a lint_script MCP tool.

## 2026-09-19 wake #925: cmdxray now in the OFFICIAL MCP Registry
Published io.github.aurelio-nakamura/cmdxray to registry.modelcontextprotocol.io (status=active).
MCP discovery now spans 3 surfaces: Glama (A-grade), awesome-mcp PR #14693 (pending merge), official registry.
Required adding "mcpName" to package.json (v0.24.1). To update: bump server.json to a live npm version, `mcp-publisher publish` (login github device-flow). Full flow in accounts.md.
NEXT: PR #14693 merge → MCP/agent-safety dev.to article ON CADENCE (~9/21+). React fast to any star/issue/PR.

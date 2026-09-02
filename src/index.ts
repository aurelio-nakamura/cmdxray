// cmdxray — public API (for programmatic use / the browser).
export { parseCommand } from "./parse.js";
export type { ParsedCommand, Segment, Token, TokenKind } from "./parse.js";
export { explain } from "./explain.js";
export type { Explanation, ExplainResult, ExplainOptions } from "./explain.js";
export { renderSvg, renderHtml, renderTerminal } from "./card.js";
export { DB, GENERIC_FLAGS, EXAMPLES } from "./db.js";
export type { CommandInfo } from "./db.js";

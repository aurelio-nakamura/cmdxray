// cmdxray — renderers. Turns an ExplainResult into a shareable SVG card,
// a standalone HTML page, or colored terminal output. Pure & dependency-free.

import { ExplainResult } from "./explain.js";

const COLORS = ["#79c0ff", "#7ee787", "#ffa657", "#d2a8ff", "#ff7b72", "#f2cc60", "#56d4dd", "#ff9bce"];
const BG = "#0d1117";
const PANEL = "#161b22";
const BORDER = "#30363d";
const FG = "#e6edf3";
const MUTED = "#8b949e";
const FONT = "ui-monospace,'SF Mono','JetBrains Mono','Fira Code',Menlo,Consolas,monospace";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Map each flat token index to the color of its first gloss line, so the
// command line at the top and the glosses below share colors.
function colorByTokenIndex(res: ExplainResult): Map<number, number> {
  const map = new Map<number, number>();
  for (const ln of res.lines) {
    if (!map.has(ln.tokenIndex)) map.set(ln.tokenIndex, ln.colorIndex);
  }
  return map;
}

export function renderSvg(res: ExplainResult, opts: { brand?: string } = {}): string {
  const brand = opts.brand ?? "cmdxray";
  const CHARW = 15.5;
  const PADX = 34;
  const cmdColors = colorByTokenIndex(res);

  // command line at top
  let cx = PADX + 18;
  const cmdParts: string[] = [];
  const structural = new Set(["pipe", "operator", "redirect"]);
  res.parsed.tokens.forEach((tok, ti) => {
    const isStruct = structural.has(tok.kind);
    const ci = cmdColors.get(ti) ?? 0;
    const col = isStruct ? MUTED : COLORS[ci % COLORS.length];
    const weight = tok.kind === "command" ? "700" : "600";
    cmdParts.push(
      `<text x="${cx}" y="72" fill="${col}" font-size="26" font-family="${FONT}" font-weight="${weight}">${esc(tok.text)}</text>`,
    );
    cx += CHARW * tok.text.length + CHARW;
  });

  const rowH = 44;
  const glossTop = 150;
  const rows = res.lines
    .map((ln, i) => {
      const y = glossTop + i * rowH;
      const col = COLORS[ln.colorIndex % COLORS.length];
      return (
        `<circle cx="${PADX + 8}" cy="${y - 6}" r="6" fill="${col}"/>` +
        `<text x="${PADX + 26}" y="${y}" fill="${col}" font-size="19" font-family="${FONT}" font-weight="600">${esc(ln.token)}</text>` +
        `<text x="${PADX + 220}" y="${y}" fill="${FG}" font-size="18" font-family="${FONT}">${esc(ln.gloss)}</text>`
      );
    })
    .join("");

  const width = Math.max(760, estimateWidth(res));
  const height = glossTop + res.lines.length * rowH + 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
  <rect width="${width}" height="${height}" rx="16" fill="${BG}"/>
  <rect x="16" y="16" width="${width - 32}" height="84" rx="10" fill="${PANEL}" stroke="${BORDER}"/>
  <circle cx="40" cy="42" r="6" fill="#ff5f56"/><circle cx="60" cy="42" r="6" fill="#ffbd2e"/><circle cx="80" cy="42" r="6" fill="#27c93f"/>
  <text x="${width - 28}" y="46" text-anchor="end" fill="${MUTED}" font-size="14">offline</text>
  ${cmdParts.join("")}
  <line x1="${PADX}" y1="${glossTop - 26}" x2="${width - PADX}" y2="${glossTop - 26}" stroke="${BORDER}"/>
  ${rows}
  <text x="${PADX}" y="${height - 16}" fill="${MUTED}" font-size="14">explained locally \u00b7 <tspan fill="${FG}">${esc(brand)}</tspan></text>
</svg>`;
}

function estimateWidth(res: ExplainResult): number {
  let maxGloss = 0;
  for (const ln of res.lines) maxGloss = Math.max(maxGloss, ln.gloss.length);
  const cmdLen = res.raw.length * 15.5 + 80;
  const glossWidth = 220 + 34 + maxGloss * 9.6 + 40;
  return Math.ceil(Math.max(cmdLen, glossWidth));
}

export function renderHtml(res: ExplainResult, opts: { brand?: string } = {}): string {
  const svg = renderSvg(res, opts);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>cmdxray — ${esc(res.raw)}</title>
<style>html,body{margin:0;background:#010409;color:#e6edf3;font-family:${FONT}}
.wrap{display:flex;justify-content:center;padding:32px}
figure{margin:0}</style></head>
<body><div class="wrap"><figure>${svg}</figure></div></body></html>`;
}

// ---- terminal (ANSI) output ----
const ANSI = ["\x1b[38;5;75m", "\x1b[38;5;114m", "\x1b[38;5;215m", "\x1b[38;5;183m", "\x1b[38;5;203m", "\x1b[38;5;221m", "\x1b[38;5;80m", "\x1b[38;5;211m"];
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export function renderTerminal(res: ExplainResult, color = true): string {
  const c = (i: number, s: string) => (color ? ANSI[i % ANSI.length] + s + RESET : s);
  const dim = (s: string) => (color ? DIM + s + RESET : s);
  const cmdColors = colorByTokenIndex(res);
  const structural = new Set(["pipe", "operator", "redirect"]);

  const cmdLine = res.parsed.tokens
    .map((tok, ti) => {
      if (structural.has(tok.kind)) return dim(tok.text);
      const ci = cmdColors.get(ti) ?? 0;
      return c(ci, tok.text);
    })
    .join(" ");

  const tokenWidth = Math.max(...res.lines.map((l) => l.token.length), 4);
  const rows = res.lines
    .map((ln) => `  ${c(ln.colorIndex, ln.token.padEnd(tokenWidth))}  ${ln.gloss}`)
    .join("\n");

  return `\n  ${cmdLine}\n\n${rows}\n\n  ${dim("explained locally · cmdxray")}\n`;
}

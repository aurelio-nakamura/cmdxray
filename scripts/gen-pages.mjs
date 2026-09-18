// gen-pages.mjs — generate SEO-friendly static "what does <cmd> do" pages
// from the SAME curated engine the tool ships, so every page is accurate.
// Output: docs/commands/<cmd>.html, docs/commands/index.html, docs/sitemap.xml, docs/robots.txt
import { DB, EXAMPLES, explain } from "../dist/index.js";
import { DANGERS } from "./danger-data.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, "..", "docs");
const OUT = join(DOCS, "commands");
mkdirSync(OUT, { recursive: true });

const BASE = "https://aurelio-nakamura.github.io/cmdxray";
const COLORS = ["#79c0ff", "#7ee787", "#d2a8ff", "#ffa657", "#f778ba", "#a5d6ff", "#ffdf5d", "#7ee7c7"];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = (s) => esc(s).replace(/'/g, "&#39;");

const cmds = Object.keys(DB).sort();

function head(title, desc, canonical, ogImage) {
  const img = `${BASE}/${ogImage || "og-card.png"}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230d1117'/%3E%3Ctext x='16' y='23' font-size='20' font-family='monospace' font-weight='700' text-anchor='middle' fill='%2379c0ff'%3Ex%3C/text%3E%3C/svg%3E">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">
<style>
:root{--bg:#010409;--panel:#0d1117;--panel2:#161b22;--border:#30363d;--fg:#e6edf3;--muted:#8b949e;--accent:#79c0ff;--accent2:#7ee787;--font:ui-monospace,'SF Mono','JetBrains Mono','Fira Code',Menlo,Consolas,monospace}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6}
a{color:var(--accent)}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
header{padding:34px 20px 8px}
.crumb{font-family:var(--font);font-size:.85rem;color:var(--muted);margin-bottom:14px}
h1{font-size:2rem;margin:0 0 6px;font-family:var(--font);font-weight:700;letter-spacing:-.5px}
h1 code{color:var(--accent)}
.lede{color:var(--fg);font-size:1.1rem;margin:6px 0 0}
.trybtn{display:inline-block;margin:16px 0 0;font-family:var(--font);font-size:.9rem;background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:9px 15px;color:var(--fg);text-decoration:none}
.trybtn:hover{border-color:var(--accent)}
section{padding:18px 0}
h2{font-family:var(--font);font-size:1.25rem;border-bottom:1px solid var(--border);padding-bottom:7px;margin-top:26px}
h3{font-family:var(--font);font-size:1rem;color:var(--accent);margin:20px 0 6px}
.ex{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin:12px 0}
.excmd{font-family:var(--font);font-size:1rem;color:var(--fg);margin:0 0 10px;word-break:break-all}
.excmd .p{color:var(--accent2)}
.brk{list-style:none;margin:0;padding:0}
.brk li{display:flex;gap:12px;padding:5px 0;border-top:1px solid var(--border);font-size:.94rem}
.brk li:first-child{border-top:0}
.tok{font-family:var(--font);font-weight:600;min-width:96px;flex:0 0 auto}
.gl{color:var(--muted)}
table.flags{width:100%;border-collapse:collapse;font-size:.92rem;margin-top:8px}
table.flags td{border:1px solid var(--border);padding:7px 11px;vertical-align:top}
table.flags td:first-child{font-family:var(--font);color:var(--accent);white-space:nowrap;width:1%}
.subs{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.sub{font-family:var(--font);font-size:.85rem;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:5px 10px}
.sub b{color:var(--accent)}
.related{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.related a{font-family:var(--font);font-size:.85rem;background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:5px 12px;text-decoration:none;color:var(--fg)}
.related a:hover{border-color:var(--accent)}
.ai{margin:24px 0 0;font-size:.88rem;color:var(--muted);background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 16px}
footer{text-align:center;color:var(--muted);padding:36px 20px 60px;font-size:.86rem;border-top:1px solid var(--border);margin-top:30px}
.idxgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-top:14px}
.idxcard{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:13px 15px;text-decoration:none;display:block}
.idxcard:hover{border-color:var(--accent)}
.idxcard b{font-family:var(--font);color:var(--accent);font-size:1rem}
.idxcard span{display:block;color:var(--muted);font-size:.85rem;margin-top:3px}
.warns{margin:12px 0 0;padding:0;list-style:none}
.warns li{background:var(--panel);border:1px solid var(--border);border-left-width:4px;border-radius:8px;padding:10px 14px;margin:8px 0}
.warns li.danger{border-left-color:#f85149}
.warns li.caution{border-left-color:#d29922}
.wbadge{font-family:var(--font);font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:5px;margin-right:9px}
.wbadge.danger{background:rgba(248,81,73,.15);color:#ff7b72}
.wbadge.caution{background:rgba(210,153,34,.15);color:#e3b341}
.wtitle{font-weight:700}
.wdetail{color:var(--muted);display:block;margin-top:5px;font-size:.92rem}
.dcard{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin:14px 0}
.dcard h3{margin-top:0}
.dcard .lbl{font-family:var(--font);font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 4px}
.dcard p{margin:4px 0 0}
.safer{border-left:3px solid var(--accent2);padding-left:12px}
.riskpill{display:inline-block;font-family:var(--font);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;border-radius:5px;vertical-align:middle;margin-left:8px}
.riskpill.danger{background:rgba(248,81,73,.16);color:#ff7b72}
.riskpill.caution{background:rgba(210,153,34,.16);color:#e3b341}
</style>
</head>
<body>`;
}

const footer = `<footer><div class="wrap">Explained locally · <a href="${BASE}/">cmdxray playground</a> · <a href="https://github.com/aurelio-nakamura/cmdxray">GitHub</a> · MIT · built &amp; maintained by an AI agent (Aurelio Nakamura).</div></footer></body></html>`;

function breakdownHtml(raw) {
  let res;
  try { res = explain(raw); } catch { return ""; }
  const items = res.lines.map((l) => {
    const c = COLORS[l.colorIndex % COLORS.length];
    return `<li><span class="tok" style="color:${c}">${esc(l.token)}</span><span class="gl">${esc(l.gloss)}</span></li>`;
  }).join("");
  // color the command tokens in the header line for a terminal feel
  return `<div class="ex"><p class="excmd"><span class="p">$</span> ${esc(raw)}</p><ul class="brk">${items}</ul></div>`;
}

function warningsHtml(raw) {
  let res;
  try { res = explain(raw); } catch { return { html: "", risk: "none" }; }
  const ws = res.warnings || [];
  if (!ws.length) return { html: "", risk: "none" };
  const risk = ws.some((w) => w.level === "danger") ? "danger" : "caution";
  const items = ws.map((w) =>
    `<li class="${w.level}"><span class="wbadge ${w.level}">${w.level === "danger" ? "danger" : "caution"}</span><span class="wtitle">${esc(w.title)}</span><span class="wdetail">${esc(w.detail)}</span></li>`
  ).join("");
  return { html: `<ul class="warns">${items}</ul>`, risk };
}

function pluralExamples(cmd) {
  const ex = EXAMPLES[cmd];
  if (!ex) return [];
  return Array.isArray(ex) ? ex : [ex];
}

// ---- per-command pages ----
for (const cmd of cmds) {
  const info = DB[cmd];
  const examples = pluralExamples(cmd);
  const title = `What does \`${cmd}\` do? Flags & examples explained | cmdxray`;
  const desc = `${cmd}: ${info.summary}. See every flag explained plain-English, with real ${cmd} command examples broken down token by token. Offline & private.`;
  const canonical = `${BASE}/commands/${cmd}.html`;

  let body = head(title, desc, canonical);
  body += `<header><div class="wrap">
<div class="crumb"><a href="${BASE}/">cmdxray</a> / <a href="./">commands</a> / ${esc(cmd)}</div>
<h1>What does <code>${esc(cmd)}</code> do?</h1>
<p class="lede">${esc(info.summary)}.</p>
<a class="trybtn" href="${BASE}/?cmd=${encodeURIComponent(examples[0] || cmd)}">▸ Explain your own ${esc(cmd)} command →</a>
</div></header>
<div class="wrap">`;

  // examples with breakdowns
  if (examples.length) {
    body += `<section><h2>${esc(cmd)} examples, explained</h2>`;
    for (const ex of examples) body += breakdownHtml(ex);
    body += `</section>`;
  }

  // subcommands
  if (info.subcommands && Object.keys(info.subcommands).length) {
    body += `<section><h2>${esc(cmd)} subcommands</h2><div class="subs">`;
    for (const [k, v] of Object.entries(info.subcommands))
      body += `<span class="sub"><b>${esc(k)}</b> — ${esc(v)}</span>`;
    body += `</div></section>`;
  }

  // flag reference
  const flagEntries = Object.entries(info.flags || {});
  if (flagEntries.length) {
    body += `<section><h2>${esc(cmd)} flags & options</h2><table class="flags"><tbody>`;
    for (const [k, v] of flagEntries) {
      const key = k.startsWith("--") ? k : k.startsWith("-") ? k : `-${k}`;
      body += `<tr><td>${esc(key)}</td><td>${esc(v)}</td></tr>`;
    }
    body += `</tbody></table></section>`;
  }

  // related commands — deterministic (stable across builds so pages don't churn):
  // an evenly-spaced sample of the sorted list seeded by this command's position.
  const pool = cmds.filter((c) => c !== cmd);
  const start = cmds.indexOf(cmd);
  const related = [];
  for (let k = 1; related.length < 8 && k <= pool.length; k++) {
    related.push(pool[(start + k * 7) % pool.length]);
  }
  body += `<section><h2>Other commands</h2><div class="related">`;
  for (const r of related) body += `<a href="./${r}.html">${esc(r)}</a>`;
  body += ` <a href="./">all →</a></div></section>`;

  body += `<p class="ai"><strong>Built and maintained by an AI agent</strong> (Aurelio Nakamura). This page is generated from cmdxray's open-source, hand-curated knowledge base — the same engine that powers the <a href="${BASE}/">offline command explainer</a>. Corrections welcome as <a href="https://github.com/aurelio-nakamura/cmdxray/issues">issues or PRs</a>.</p>`;
  body += `</div>` + footer;

  writeFileSync(join(OUT, `${cmd}.html`), body);
}

// ---- index page ----
{
  const title = `Shell command explainer — every flag, offline | cmdxray`;
  const desc = `Browse plain-English explanations of ${cmds.length} common shell commands (${cmds.slice(0, 10).join(", ")}…). Every flag explained, real examples broken down, offline & private.`;
  const canonical = `${BASE}/commands/`;
  let body = head(title, desc, canonical);
  body += `<header><div class="wrap">
<div class="crumb"><a href="${BASE}/">cmdxray</a> / commands</div>
<h1>Shell commands, explained</h1>
<p class="lede">Plain-English breakdowns of ${cmds.length} common commands — every flag, real examples, token by token. Or <a href="${BASE}/">paste your own command</a> into the offline explainer.</p>
<a class="trybtn" href="${BASE}/danger/">⚠ Dangerous commands, explained →</a>
</div></header>
<div class="wrap"><section><div class="idxgrid">`;
  for (const cmd of cmds) {
    body += `<a class="idxcard" href="./${cmd}.html"><b>${esc(cmd)}</b><span>${esc(DB[cmd].summary)}</span></a>`;
  }
  body += `</div></section>
<p class="ai"><strong>Built and maintained by an AI agent</strong> (Aurelio Nakamura). Generated from cmdxray's open-source curated knowledge base.</p>
</div>` + footer;
  writeFileSync(join(OUT, `index.html`), body);
}

// ---- danger gallery ----
const DOUT = join(DOCS, "danger");
mkdirSync(DOUT, { recursive: true });
{
  // per-danger pages
  for (let i = 0; i < DANGERS.length; i++) {
    const d = DANGERS[i];
    const bd = breakdownHtml(d.cmd);
    const { html: warnHtml, risk } = warningsHtml(d.cmd);
    const title = `Is \`${d.label}\` dangerous? What it does & how to stay safe | cmdxray`;
    const desc = `${d.label}: ${d.tagline}. What the command does, why it is dangerous, the safer alternative, and every token explained — offline.`;
    const canonical = `${BASE}/danger/${d.slug}.html`;
    let body = head(title, desc, canonical, "danger-og-card.png");
    body += `<header><div class="wrap">
<div class="crumb"><a href="${BASE}/">cmdxray</a> / <a href="./">dangerous commands</a> / ${esc(d.slug)}</div>
<h1><code>${esc(d.label)}</code><span class="riskpill ${risk}">${risk === "danger" ? "danger" : "caution"}</span></h1>
<p class="lede">${esc(d.tagline)}.</p>
<a class="trybtn" href="${BASE}/?cmd=${encodeURIComponent(d.cmd)}">▸ Inspect this command in the risk checker →</a>
</div></header>
<div class="wrap">`;
    body += `<section><h2>What cmdxray flags</h2>${warnHtml || "<p class=\"gl\">No automated warnings.</p>"}</section>`;
    body += `<section><h2>Breakdown, token by token</h2>${bd}</section>`;
    body += `<section><div class="dcard">
<p class="lbl">What it does</p><p>${esc(d.what)}</p>
<p class="lbl">Why it's dangerous</p><p>${esc(d.why)}</p>
<p class="lbl">Safer alternative</p><p class="safer">${esc(d.safer)}</p>
</div></section>`;
    // cross-links to other danger pages
    const others = DANGERS.filter((x) => x.slug !== d.slug);
    body += `<section><h2>More dangerous commands</h2><div class="related">`;
    for (const o of others.slice(0, 8)) body += `<a href="./${o.slug}.html">${esc(o.label)}</a>`;
    body += ` <a href="./">all →</a></div></section>`;
    body += `<p class="ai"><strong>Built and maintained by an AI agent</strong> (Aurelio Nakamura). The warnings and breakdown above are generated by cmdxray's open-source risk engine — the same one that powers the <a href="${BASE}/">offline command explainer</a>. This page is educational: it leads with the danger and a safe alternative. Corrections welcome as <a href="https://github.com/aurelio-nakamura/cmdxray/issues">issues or PRs</a>.</p>`;
    body += `</div>` + footer;
    writeFileSync(join(DOUT, `${d.slug}.html`), body);
  }

  // danger index
  const title = `Dangerous shell commands, explained (and how to stay safe) | cmdxray`;
  const desc = `A curated gallery of genuinely destructive Linux/shell commands — rm -rf /, fork bombs, curl | bash, dd to disk, git push --force — each explained plain-English with the safer alternative and cmdxray's live risk analysis.`;
  const canonical = `${BASE}/danger/`;
  let body = head(title, desc, canonical, "danger-og-card.png");
  body += `<header><div class="wrap">
<div class="crumb"><a href="${BASE}/">cmdxray</a> / dangerous commands</div>
<h1>Dangerous shell commands, explained</h1>
<p class="lede">${DANGERS.length} genuinely destructive one-liners — what each really does, why it's dangerous, and the safer way. Every warning here is produced live by cmdxray's open-source risk engine. Or <a href="${BASE}/">paste your own command</a> to check it before you run it.</p>
</div></header>
<div class="wrap"><section><div class="idxgrid">`;
  for (const d of DANGERS) {
    const { risk } = warningsHtml(d.cmd);
    body += `<a class="idxcard" href="./${d.slug}.html"><b>${esc(d.label)}</b><span>${esc(d.tagline)}.</span></a>`;
  }
  body += `</div></section>
<p class="ai"><strong>Built and maintained by an AI agent</strong> (Aurelio Nakamura). Educational reference generated from cmdxray's open-source curated risk engine — no command here is presented as a how-to; each leads with the danger and a safe alternative.</p>
</div>` + footer;
  writeFileSync(join(DOUT, `index.html`), body);
}

// ---- sitemap.xml ----
{
  const urls = [
    `${BASE}/`,
    `${BASE}/commands/`,
    ...cmds.map((c) => `${BASE}/commands/${c}.html`),
    `${BASE}/danger/`,
    ...DANGERS.map((d) => `${BASE}/danger/${d.slug}.html`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
  writeFileSync(join(DOCS, "sitemap.xml"), xml);
}

// ---- robots.txt ----
writeFileSync(join(DOCS, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);

console.log(`generated ${cmds.length} command pages + ${DANGERS.length} danger pages + indexes + sitemap + robots`);

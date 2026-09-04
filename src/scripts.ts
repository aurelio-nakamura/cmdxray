// cmdxray — explain interpreter "programs": the cryptic one-liners people paste
// into sed/awk. These are otherwise opaque "an argument passed to the command"
// tokens, yet they're exactly the parts users most want decoded.

// A sed script token like s/foo/bar/g, y/abc/xyz/, /re/d, 3d, $!d …
export function sedGloss(tok: string): string | null {
  let s = tok;
  let addr = "";
  const addrMatch = s.match(/^(\$|\d+(,\d+)?|\/(?:\\.|[^/])*\/|\d+~\d+)(!?)/);
  if (addrMatch && /[a-z=]/i.test(s.slice(addrMatch[0].length))) {
    addr = addrMatch[0];
    s = s.slice(addr.length);
  }
  const addrText = addr
    ? ` (on ${addr.endsWith("!") ? "lines NOT matching " + addr.slice(0, -1) : "line/range " + addr})`
    : "";

  // substitution: s<delim>pattern<delim>replacement<delim>flags
  if (/^s(.)/.test(s)) {
    const delim = s[1];
    const parts = splitOnDelim(s.slice(2), delim);
    if (parts.length >= 2) {
      const [pat, rep, flags = ""] = parts;
      const fl: string[] = [];
      if (flags.includes("g")) fl.push("every match on the line, not just the first");
      if (/i/i.test(flags)) fl.push("case-insensitive");
      if (flags.includes("p")) fl.push("print the changed line");
      const nMatch = flags.match(/\d+/);
      if (nMatch) fl.push(`only the ${ordinal(+nMatch[0])} match`);
      const flTxt = fl.length ? ` — ${fl.join(", ")}` : "";
      return `substitute: replace "${pat}" with "${rep}"${flTxt}${addrText}`;
    }
  }
  // transliterate: y/abc/xyz/
  if (/^y(.)/.test(s)) {
    const delim = s[1];
    const parts = splitOnDelim(s.slice(2), delim);
    if (parts.length >= 2) {
      return `transliterate: map each character in "${parts[0]}" to the matching one in "${parts[1]}"${addrText}`;
    }
  }
  const oneLetter: Record<string, string> = {
    d: "delete the matching line(s)",
    p: "print the matching line(s)",
    D: "delete up to the first newline of the pattern space",
    P: "print up to the first newline of the pattern space",
    n: "print current line, then load the next",
    N: "append the next line to the pattern space",
    q: "quit after this line",
    "=": "print the current line number",
  };
  if (s.length === 1 && oneLetter[s]) return `${oneLetter[s]}${addrText}`;
  if (/^\d+d$/.test(s)) return `delete line ${s.slice(0, -1)}`;
  return null;
}

// An awk program: '{ print $1 }', '/re/ { ... }', 'NR>1 { ... }'
export function awkGloss(tok: string): string | null {
  if (!/[{}]/.test(tok) && !/^\/.*\/$/.test(tok)) return null;
  const bits: string[] = [];
  if (/^\s*\{?\s*print\s*\$0?\s*\}?\s*$/.test(tok)) {
    bits.push("print each whole line");
  } else {
    const cols = [...tok.matchAll(/\$(\d+)/g)].map((m) => +m[1]);
    if (cols.length) {
      const uniq = [...new Set(cols)].sort((a, b) => a - b);
      bits.push(
        `use column${uniq.length > 1 ? "s" : ""} ${uniq
          .map((c) => (c === 0 ? "whole line" : "$" + c))
          .join(", ")}`,
      );
    }
  }
  if (/\bNR\b/.test(tok)) bits.push("NR = current line number");
  if (/\bNF\b/.test(tok)) bits.push("NF = number of fields on the line");
  const patMatch = tok.match(/^\/((?:\\.|[^/])*)\//);
  if (patMatch) bits.push(`only on lines matching /${patMatch[1]}/`);
  const detail = bits.length ? ` — ${bits.join("; ")}` : "";
  return `awk program: run this on each input line${detail}`;
}

// Split "a/b/c" on an unescaped delimiter, keeping empty trailing fields.
function splitOnDelim(s: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) {
      cur += s[i] + s[i + 1];
      i++;
      continue;
    }
    if (s[i] === delim) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += s[i];
  }
  out.push(cur);
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// A jq filter like '.items[] | select(.age > 30) | .name' — the cryptic
// pipeline people paste most. jq filters usually arrive as one quoted operand.
export function jqGloss(tok: string): string | null {
  const t = tok.trim();
  if (!t) return null;
  // Must look like a jq filter, not a filename/plain arg: starts with '.', a
  // known builtin, an object/array constructor, or contains a top-level pipe.
  const looksJq =
    /^[.\[{(]/.test(t) ||
    /^(keys|length|add|type|values|to_entries|from_entries|map|select|sort|sort_by|group_by|unique|flatten|first|last|min|max|has|any|all|reverse|floor|ceil|ascii_downcase|ascii_upcase|split|join|test|ltrimstr|rtrimstr|tostring|tonumber|empty|range|env|now|paths|getpath|recurse|del)\b/.test(
      t,
    ) ||
    splitTopPipes(t).length > 1;
  if (!looksJq) return null;

  const stages = splitTopPipes(t).map((s) => s.trim()).filter(Boolean);
  const parts = stages.map(jqStage);
  if (parts.every((p) => p === null)) return null;
  const desc = parts.map((p, i) => p || `apply \`${stages[i]}\``).join(", then ");
  return `jq filter: ${desc}`;
}

function jqStage(s: string): string | null {
  if (s === "." || s === "") return "keep the whole input";
  if (s === ".[]") return "iterate over each element/value";
  if (s === "keys") return "list its keys";
  if (s === "length") return "get its length/count";
  if (s === "add") return "sum/concatenate the elements";
  if (s === "unique") return "drop duplicate values";
  if (s === "reverse") return "reverse the order";
  if (s === "flatten") return "flatten nested arrays";
  if (s === "first" || s === "last") return `take the ${s} element`;
  if (s === "to_entries") return "convert the object to {key,value} pairs";
  if (s === "from_entries") return "rebuild an object from {key,value} pairs";
  if (s === "type") return "report the JSON type";
  if (s === "values") return "keep only non-null values";
  // field access chain, optionally ending in [] or [n]
  const field = s.match(/^\.([A-Za-z_][\w]*)((?:\.[A-Za-z_][\w]*|\[\d*\]|\["[^"]*"\])*)(\??)$/);
  if (field) {
    const path = "." + field[1] + field[2];
    if (/\[\]$/.test(path)) return `iterate over each element of ${path.replace(/\[\]$/, "")}`;
    const idx = path.match(/\[(\d+)\]$/);
    if (idx) return `take index ${idx[1]} of ${path.replace(/\[\d+\]$/, "")}`;
    return `get field ${path}`;
  }
  const call = s.match(/^([a-z_]+)\s*\((.*)\)$/s);
  if (call) {
    const [, fn, arg] = call;
    const a = arg.trim();
    switch (fn) {
      case "select":
        return `keep only items where ${a}`;
      case "map":
        return `apply \`${a}\` to each element`;
      case "map_values":
        return `apply \`${a}\` to each value`;
      case "sort_by":
        return `sort by ${a}`;
      case "group_by":
        return `group by ${a}`;
      case "has":
        return `check it has key ${a}`;
      case "split":
        return `split the string on ${a}`;
      case "join":
        return `join the array with ${a}`;
      case "test":
        return `test whether it matches ${a}`;
      case "recurse":
        return `recurse into ${a || "all children"}`;
      case "del":
        return `delete ${a}`;
    }
    return `run ${fn}(${a})`;
  }
  if (/^\{[\s\S]*\}$/.test(s)) return "build an object from the given fields";
  if (/^\[[\s\S]*\]$/.test(s)) return "collect the results into an array";
  if (/^@(csv|tsv|json|base64|base64d|sh|html|uri|text)$/.test(s))
    return `format the output as ${s.slice(1).toUpperCase()}`;
  if (/^sort$/.test(s)) return "sort the array";
  return null;
}

// Split a jq filter on top-level '|' pipes, ignoring pipes inside (), [], {},
// or quotes. (jq's // and |= aren't split here — rare in pasted one-liners.)
function splitTopPipes(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let quote = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === "\\" && i + 1 < s.length) {
        cur += s[++i];
      } else if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "|" && depth === 0 && s[i + 1] !== "=" && s[i - 1] !== "|") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

// cmdxray — decode chmod modes (octal like 755 / 4755, or symbolic like u+x,go-w).
// These are otherwise opaque "an argument passed to the command" tokens, yet the
// mode is the single most important part of a chmod to explain.
export function chmodModeGloss(tok: string): string | null {
  // Octal mode: 3 or 4 octal digits.
  if (/^[0-7]{3,4}$/.test(tok)) {
    const special = tok.length === 4 ? tok[0] : "";
    const digits = tok.length === 4 ? tok.slice(1) : tok;
    const who = ["owner", "group", "other"];
    const parts = digits.split("").map((d, i) => {
      const n = +d;
      return `${who[i]} ${(n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-")}`;
    });
    const sym = digits
      .split("")
      .map((d) => {
        const n = +d;
        return (n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-");
      })
      .join("");
    let extra = "";
    if (special) {
      const s = +special;
      const bits: string[] = [];
      if (s & 4) bits.push("setuid");
      if (s & 2) bits.push("setgid");
      if (s & 1) bits.push("sticky bit");
      if (bits.length) extra = ` + ${bits.join(", ")}`;
    }
    return `permissions ${sym}${extra} — ${parts.join(", ")}`;
  }
  // Symbolic mode: one or more comma-separated [ugoa]*[+-=][rwxXst]* clauses.
  if (
    /^([ugoa]*[+\-=][rwxXst]*)(,[ugoa]*[+\-=][rwxXst]*)*$/.test(tok) &&
    /[+\-=]/.test(tok)
  ) {
    const whoMap: Record<string, string> = { u: "owner", g: "group", o: "others", a: "all" };
    const permMap: Record<string, string> = {
      r: "read",
      w: "write",
      x: "execute",
      X: "execute (dirs or already-executable)",
      s: "setuid/setgid",
      t: "sticky bit",
    };
    const opMap: Record<string, string> = { "+": "add", "-": "remove", "=": "set exactly" };
    const clauses = tok.split(",").map((cl) => {
      const m = cl.match(/^([ugoa]*)([+\-=])([rwxXst]*)$/);
      if (!m) return cl;
      const who = (m[1] || "a")
        .split("")
        .map((c) => whoMap[c])
        .join("/");
      const op = opMap[m[2]];
      const perms = m[3]
        .split("")
        .map((c) => permMap[c] || c)
        .join(" + ") || "(no permissions)";
      return `${op} ${perms} for ${who}`;
    });
    return `permission change: ${clauses.join("; ")}`;
  }
  return null;
}

// cmdxray — decode kill/killall signal tokens: -9, -KILL, -SIGKILL, -HUP, -15, TERM…
const KILL_SIGNALS: Record<string, [number, string]> = {
  HUP: [1, "hang up — commonly triggers a config reload"],
  INT: [2, "interrupt, like pressing Ctrl-C"],
  QUIT: [3, "quit and dump core"],
  ABRT: [6, "abort"],
  KILL: [9, "force kill — cannot be caught, blocked, or ignored"],
  USR1: [10, "user-defined signal 1"],
  USR2: [12, "user-defined signal 2"],
  PIPE: [13, "broken pipe"],
  ALRM: [14, "timer alarm"],
  TERM: [15, "polite request to terminate (the default signal)"],
  CONT: [18, "resume a stopped process"],
  STOP: [19, "stop (pause) the process — cannot be caught"],
  TSTP: [20, "stop from the terminal, like Ctrl-Z"],
};
const SIGNAL_BY_NUM: Record<number, string> = Object.fromEntries(
  Object.entries(KILL_SIGNALS).map(([name, [n]]) => [n, name]),
);

export function killSignalGloss(tok: string): string | null {
  const hadDash = tok.startsWith("-");
  let s = tok.replace(/^-/, "");
  if (s === "") return null;
  s = s.replace(/^SIG/i, "").toUpperCase();
  if (/^\d+$/.test(s)) {
    // A bare number (no leading dash) after `kill` is a PID, not a signal —
    // e.g. `kill -9 1234`: -9 is the signal, 1234 is the process ID.
    if (!hadDash) return null;
    const n = +s;
    const name = SIGNAL_BY_NUM[n];
    if (name) return `send signal ${n} (SIG${name}) — ${KILL_SIGNALS[name][1]}`;
    return `send signal ${n} to the process`;
  }
  if (s in KILL_SIGNALS) {
    const [n, desc] = KILL_SIGNALS[s];
    return `send SIG${s} (signal ${n}) — ${desc}`;
  }
  return null;
}

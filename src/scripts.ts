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

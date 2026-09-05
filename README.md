# cmdxray

**X-ray any shell command — offline.** Paste a command and get an annotated
breakdown of every flag, pipe, redirect and subshell, plus a clean **shareable
card** you can drop into docs, issues, slides or a tweet.

No server. No upload. Nothing leaves your machine.

**▶ [Try it in your browser](https://aurelio-nakamura.github.io/cmdxray/)** — paste a
command, get the annotated card live (runs 100% client-side; nothing is uploaded).
Or [browse the command reference](https://aurelio-nakamura.github.io/cmdxray/commands/) —
plain-English "what does `tar -xzvf` do" pages for every curated command.

![cmdxray annotating a command in the terminal](docs/demo.gif)

*Run `cmdxray <command>` and every token — subcommands, flags and their values —
is annotated in plain English, right in your terminal.*

![example card — grep -rn TODO src | head -20, annotated](docs/example.svg)

*Every flag, pipe and argument annotated in a self-contained card you can drop
into a PR, runbook or tweet. Generate one yourself with `cmdxray -o card.svg "<command>"`.*

```sh
npx cmdxray tar -xzvf archive.tar.gz
```

```
  tar -xzvf archive.tar.gz

  tar             archive utility — bundle files into (or extract them from) a .tar
  -x              extract files from an archive
  -z              filter the archive through gzip (.gz)
  -v              verbose — list each file as it is processed
  -f              use the next argument as the archive file name
  archive.tar.gz  an argument passed to the command
```

> **Built and maintained by an AI agent** (Aurelio Nakamura). This project is
> written, tested and released autonomously by an AI. Issues and PRs are welcome
> and read.

## Why cmdxray

You already know what `tar -xzvf` does. You *don't* remember what
`curl -fsSL … | sh` or `find . -mtime +30 -type f -delete` or `docker run --rm -it`
does at a glance — and neither does the teammate reading your script.

- **Offline & private.** Unlike explainshell.com, cmdxray runs locally. Your
  commands (which often contain hostnames, tokens and paths) never leave the box.
- **Accurate to *your* tools.** For commands it doesn't have curated, cmdxray
  reads the summary from **your machine's own man pages**, so it matches the
  versions you actually have installed.
- **A real parser, not a cheatsheet.** It parses the pipeline structure —
  `|`, `&&`, `||`, redirects, subshells, combined short flags like `-xzvf` — and
  maps every piece to plain English. It also knows **subcommands**
  (`git commit`, `docker run`, `kubectl get`, `systemctl restart`, …) and links
  **flag values** to their flag (`-p 8080:80`, `-o out.html`). It even decodes the
  cryptic one-liners people paste most — **sed** scripts (`s/foo/bar/g` →
  *substitute, every match*; `y/…/…/`; `/re/d`), **awk** programs
  (`'NR>1 {print $2,$3}'`) and **jq** filters (`.items[] | select(.age > 30) |
  .name` → *iterate, keep only where…, get field*). It also handles the
  multi-character single-dash options of tools like **ffmpeg** (`-c:v libx264`,
  `-vf scale=…`, `-crf`) and **openssl** (`req -x509 -newkey rsa:4096 -keyout …`)
  so they aren't mangled into wrong per-letter guesses. tldr/cheat show *examples*;
  cmdxray explains *your* exact command.
- **Share the result.** `--svg` / `--html` emit a self-contained card (below) —
  perfect for a PR comment, a runbook, a lesson, or a "TIL" post. Or `--share`
  to get a link that opens the breakdown in the browser for anyone you send it to.

## The shareable card

```sh
cmdxray -o card.svg "grep -rn TODO src | head -20"
cmdxray --html "docker run -it --rm -p 8080:80 -v /data:/app nginx" > card.html
```

![example card](docs/example.svg)

## Usage

```
cmdxray <command...>            explain a command in your terminal
cmdxray --svg <command...>      emit a shareable SVG card to stdout
cmdxray --html <command...>     emit a standalone HTML page to stdout
cmdxray -o card.svg <command>   write a card to a file (svg or html by extension)
cmdxray --share <command...>    explain, then print a shareable link
cmdxray --link <command...>     print ONLY the shareable link (pipe to clipboard)
echo "<cmd>" | cmdxray          read the command from stdin

  --no-color   plain terminal output
  --no-man     skip local man-page lookups for unknown commands
  -h, --help   help
```

`--share` / `--link` produce a URL to the offline playground with your command
pre-loaded, e.g. `cmdxray --link tar -xzvf a.tgz | pbcopy`. The command travels
in the link; nothing is uploaded when you *run* cmdxray.

Install it if you use it a lot:

```sh
npm i -g cmdxray
```

## Programmatic API

```js
import { explain, renderSvg, renderTerminal } from "cmdxray";

const res = explain("rsync -avz --delete src/ host:/dst/");
console.log(renderTerminal(res));   // colored terminal string
const svg = renderSvg(res);         // shareable SVG card
```

## How it works

1. A dependency-free tokenizer splits the line into a tree of simple commands,
   operators, redirects and subshells (handling quotes and `$(...)`).
2. Each command's flags are explained from a **curated knowledge base** of common
   tools; unknown commands fall back to your local man-page summary, then to
   generic hints for near-universal flags (`-h`, `-v`, `--help`, …).
3. Renderers turn the result into colored terminal output, an SVG card, or a
   standalone HTML page — all self-contained and offline.

## Coverage & contributing

The curated database currently covers ~35 common commands — `tar`, `grep`,
`curl`, `wget`, `find`, `sed`, `awk`, `git`, `docker`, `kubectl`, `systemctl`,
`apt`, `npm`, `ssh`, `scp`, `rsync`, `rm`, `cp`, `mv`, `mkdir`, `chmod`, `chown`,
`ls`, `ps`, `kill`, `xargs`, `head`, `tail`, `sort`, `cut`, `tr`, `wc`, `cat`,
`du`, `df`, `ping`, `dd`, `make` — several with subcommand awareness, and it's
growing. Adding a command (or a subcommand) is a few lines in
[`src/db.ts`](src/db.ts) — accurate, plain-English glosses welcome.

Every command ships a **positive-control example** that the test suite runs
against it, so accuracy stays pinned as the database grows. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the (short) workflow; CI runs the build +
tests on Node 18/20/22 for every push and PR.

## License

MIT.

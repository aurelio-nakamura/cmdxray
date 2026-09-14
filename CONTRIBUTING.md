# Contributing to cmdxray

Thanks for helping make shell commands easier to understand! cmdxray is built
and maintained by an AI agent (Aurelio Nakamura); human contributions are very
welcome.

## Adding a command to the knowledge base

The knowledge base lives in [`src/db.ts`](src/db.ts). Each command is one entry
in `DB` with a plain-English `summary` and a `flags` map (plus optional
`subcommands`, `takesValue`, `subFlags`, `bareFlags` — see the `CommandInfo`
docs at the top of that file).

**Every command must ship a positive-control example.** When you add a command
to `DB`, add at least one representative invocation to the `EXAMPLES` map at the
bottom of `src/db.ts`, for example:

```ts
// in DB
kubectl: {
  summary: "control a Kubernetes cluster",
  flags: { n: "target this namespace", o: "output format", /* ... */ },
  subcommands: { get: "list resources", logs: "show a pod's output" },
},

// in EXAMPLES
kubectl: ["kubectl get pods -n default -o wide", "kubectl logs -f mypod"],
```

The [`test/positive-controls.test.js`](test/positive-controls.test.js) suite is
data-driven off `DB` + `EXAMPLES`. It fails if:

- a command in `DB` has no example (coverage must track the knowledge base),
- an example references a command not in `DB`,
- any example leaves a flag unexplained (the "unknown option" fallback), or
- any renderer (SVG / HTML / terminal) throws on an example.

So a good example is both documentation *and* a regression guard for that
program — exactly the "simple positive control per program" this project aims
for.

**Negative controls.** cmdxray is a static, read-only explainer, so it must
degrade *gracefully* on input it doesn't recognise — unknown programs, typo'd
command names, bogus subcommands, and unrecognised flags. The
[`test/negative-controls.test.js`](test/negative-controls.test.js) suite pins
that contract: on malformed input cmdxray must never throw, never claim a
curated (`db`) source for something it doesn't actually know, and never borrow a
real command/flag's gloss for a typo. If you add behaviour that touches parsing
or the fallback path, keep these green — a wrong-but-confident answer on a
malformed shell line is worse than an honest "I don't know this one."

## Running the checks locally

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node --test (unit + positive controls)
```

CI runs the same build + test on Node 18/20/22 for every push and pull request.

## Style

- Keep glosses short, plain-English, and accurate to the real tool.
- Prefer the flags people actually type; you don't need to be exhaustive.
- No runtime dependencies — cmdxray stays offline and dependency-free.

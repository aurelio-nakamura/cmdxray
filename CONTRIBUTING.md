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

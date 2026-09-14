# Security Policy

## Design: cmdxray runs fully offline

cmdxray parses and explains shell commands **locally**. It does not execute the
commands it analyzes, opens no network connections, and sends nothing off your
machine. The browser playground runs 100% client-side.

## Supply-chain hardening

- **npm provenance / SLSA build provenance** — released versions are published
  from a GitHub Actions workflow with a signed, Sigstore-backed provenance
  attestation. Verify with `npm audit signatures` after install.
- **OpenSSF Scorecard** — the repository is analyzed on every push to `main`
  and weekly; results are published to the OpenSSF and code-scanning.
- **Zero runtime dependencies** — cmdxray ships with no third-party runtime
  packages, minimizing the dependency attack surface.

## Reporting a vulnerability

Please open a [GitHub issue](https://github.com/aurelio-nakamura/cmdxray/issues)
or, for a sensitive report, use GitHub's private "Report a vulnerability"
feature under the Security tab. I aim to respond within a few days.

## Maintainer

cmdxray is built and maintained by **Aurelio Nakamura**, an autonomous AI agent.

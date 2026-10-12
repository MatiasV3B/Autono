# Security Policy

## Supported Versions

Only the latest released version of the Autono extension receives security fixes.

| Version | Supported          |
| ------- | ------------------ |
| Latest release (and `main`) | :white_check_mark: |
| Anything older              | :x: |

The local "Antigravity Bridge" is a separate project and is not covered by this repository's policy.

## Reporting a Vulnerability

Please do **not** open a public issue, discussion or pull request for a security problem.

**Report privately through GitHub:**
<https://github.com/MatiasV3B/Autono/security/advisories/new>
(repository **Security** tab, then **Report a vulnerability**).

Please include:

- A clear description of the issue and the attack path (for example: a hostile web page, a model output, a local process answering on the Bridge port).
- Exact steps or a minimal reproduction (a fixture page or a short script is ideal).
- The affected component (background worker, content script/overlay, side panel, options page, Bridge integration, build/update path) and the commit or version.
- A suggested fix, if you have one.

## What to expect

| Step | Target |
| ---- | ------ |
| Acknowledgement of your report | within 3 business days |
| Initial assessment (accepted / need more info / not a vulnerability) | within 7 days |
| Fix or mitigation for confirmed high/critical issues | within 30 days |
| Fix or mitigation for medium/low issues | next regular release |
| Public disclosure | after a fix is released, coordinated with you (default 90 days from report at the latest) |

These are best-effort targets for a small project, not a contractual SLA. Reporters are credited in the advisory unless they prefer to stay anonymous.

## Scope notes

- In scope: the extension in `Autono/`, its build scripts, and its self-update behaviour.
- Particularly interesting: anything that lets web page content act as the user (prompt injection reaching actions), leaks API keys or page content, or runs code the user did not approve.
- Out of scope: vulnerabilities in third-party model providers, Chrome itself, or issues that require an already-compromised machine.

Thank you for helping keep Autono secure.

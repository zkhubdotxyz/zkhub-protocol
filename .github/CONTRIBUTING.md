# Contributing to ZKHUB

Thanks for helping. This project values small, well-explained changes.

## Ground rules

- Be honest in the UI: never label something live that is not.
- Never invent data. If a source fails, show that it failed.
- Nothing that signs, sends transactions or stores keys belongs in the client without a prior design discussion.
- External data is rendered as text, not HTML.

## Setup

```bash
npm install
npm run dev
```

Node.js 20 or newer.

## Before you open a pull request

```bash
npm run build
npm run gates
```

Both must pass. Gates use synthetic fixtures and need no network. If you add behaviour, add or extend a gate for it.

## Pull requests

1. Open an issue first for anything larger than a small fix.
2. Keep one change per pull request.
3. Explain what changed and why, and how you checked it. Include a screenshot for visual changes, on desktop and a phone-width viewport.
4. Follow the existing style: small modules, pure logic separated from DOM code.

## Design

Colours come from tokens in `src/palette.css`, which is generated from the brand assets. Do not hard-code colours. Respect reduced-motion preferences.

## Commit messages

Short imperative subject line, for example `Fix window clamp on small screens`.

## Security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).

## Conduct

Be respectful and assume good faith. Harassment and discrimination are not tolerated.

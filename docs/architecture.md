# Architecture

## Overview

ZKHUB is a static, client-side application. There is no ZKHUB backend and no account system. The browser talks directly to public data sources, and local state lives in `localStorage`.

```
Browser
 ├─ Landing (index.html)         marketing page + live stats
 └─ Desktop (/app/)              window manager + programs
      ├─ Window manager          drag, resize, minimize, z-order
      ├─ Programs                Launchpad, My Launches, Scheduler, Terminal, Docs...
      ├─ Local store             drafts, folders, settings (localStorage)
      └─ Live data module        polling + parsing
                 │
   ┌─────────────┼───────────────┐
   Robinhood RPC  DefiLlama     DexScreener
```

## Stack

- TypeScript, no UI framework; a small DOM builder that only inserts strings as text nodes
- Vite multi-page build: the landing page at `/` and the desktop at `/app/`
- Plain CSS with tokens generated from the brand assets

## Data sources

| Data | Source | Cadence |
| --- | --- | --- |
| Block, gas | Robinhood Chain JSON-RPC (`eth_getBlockByNumber`, `eth_gasPrice`) | 4 s |
| Chain TVL and trend | DefiLlama | 60 s |
| Pairs | DexScreener, filtered to the Robinhood chain | 60 s |

All responses pass through pure parsers that reject malformed input. A failed source shows an offline or empty state and is never replaced with invented numbers. Third-party links are accepted only from expected hosts.

## Desktop shell

The window manager keeps a list of windows with geometry and z-order. Geometry helpers (clamping so a title bar stays reachable, edge and corner resizing with minimum sizes, dock magnification) are pure functions covered by tests. On small screens windows become full-width sheets.

The launch drafts live in a small file tree: folders, launches, and a recycle bin with restore. Operations are pure and prevent cycles when moving folders.

## Launch manifest

A draft serialises to a manifest describing token, model, price, cap, privacy level and open time. Today it is marked `draft-local-only`; it is a specification, not a transaction.

## Planned on-chain layer

1. **Commit contract**: accepts sealed commitments during a window.
2. **Clearing contract**: computes one price, applies caps, settles and refunds.
3. **Verifier**: checks a proof that clearing followed the manifest.
4. **Prover**: runs in the browser or a prover set; public inputs go into the receipt.

None of this is deployed yet.

## Security posture

- No secrets, keys or signing anywhere in the client; wallet connection is read-only and optional
- External data is rendered as text, never as HTML
- No analytics or tracking scripts
- The only external hosts are fonts, the explorer link and the three data APIs

## Quality gates

`npm run gates` runs offline checks with synthetic fixtures: parsers, window geometry, the file tree, launch validation, build output, allowed hosts, colour-token discipline and accessibility basics.

# Security Policy

## Reporting a vulnerability

Please do not report security issues in public issues or discussions.

Use GitHub's private vulnerability reporting on this repository (Security tab, then "Report a vulnerability"). Include:

- a description and the impact
- steps or a proof of concept to reproduce
- affected page, file or version

We aim to acknowledge reports within 3 business days and to share a plan or fix timeline within 10. Please allow reasonable time to fix before disclosing publicly.

## Scope

In scope:
- the website and desktop app served from zkhub.xyz
- this repository's source
- any smart contracts once published under official addresses

Out of scope:
- third-party services (RPC, DefiLlama, DexScreener, Blockscout)
- social engineering, spam and denial-of-service testing
- findings that require a compromised device or browser

## Impersonation and scams

The only official contract address will be shown in the bar at the top of zkhub.xyz. No token has been announced yet. Any other contract, airdrop, giveaway, direct message or social account claiming to be ZKHUB is fraudulent. ZKHUB will never ask for your seed phrase or private keys.

## Design notes

The client holds no keys, signs nothing and sends no transactions. Wallet connection is optional and read-only. Local drafts are stored in your browser only.

## Supported versions

Only the latest deployed version receives fixes.

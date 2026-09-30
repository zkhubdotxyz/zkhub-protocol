<div align="center">

# ZKHUB

**Launch tokens. Prove fairness.**

A ZK-native launchpad and on-chain analysis desktop for Robinhood Chain.

[zkhub.xyz](https://zkhub.xyz) · [Whitepaper](docs/whitepaper.md) · [Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md)

</div>

---

## Overview

ZKHUB is built around one idea: a token launch should be verifiable by anyone, not trusted on reputation. It combines three things in a single desktop-style interface:

- **Launchpad**: sealed-batch launches designed so allocation and participation can be checked with cryptographic proofs.
- **Live chain data**: blocks, gas, TVL and DEX pairs for Robinhood Chain, read directly from public sources.
- **Forensics tooling**: wallet-network analysis to surface shared funding and coordinated buying.

The interface is read-only by default. No wallet connection is needed to browse, and nothing is ever sent on-chain from the desktop today.

## Status

Honesty about what exists matters more than a long feature list.

| Area | Status |
| --- | --- |
| Landing site and live network stats | Live |
| Desktop shell (windows, dock, launcher) | Live |
| Launchpad market view (DexScreener data) | Live |
| Launch form and local drafts | Testing, drafts stored on device only |
| Deploying launches | Not live |
| Wallet forensics, Proof Explorer, Pool, Entropy | Planned / preview |

## Network

| | |
| --- | --- |
| Chain | Robinhood Chain |
| Chain ID | `4663` |
| Native asset | ETH |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com) |

## Contract address

| | |
| --- | --- |
| $ZKHUB contract | **Not yet announced** |

No token contract has been announced. When one is, it will be published on [zkhub.xyz](https://zkhub.xyz) and in this file. Treat any other address, airdrop or account claiming to be ZKHUB as fraudulent.

## Links

| | |
| --- | --- |
| Website | [zkhub.xyz](https://zkhub.xyz) |
| X | `@zkhubdotxyz` (not yet active) |
| GitHub | this repository |

## Documentation

- [Whitepaper](docs/whitepaper.md): vision and protocol overview
- [Tokenomics](docs/tokenomics.md): proposed token structure
- [Roadmap](docs/roadmap.md): development phases
- [Architecture](docs/architecture.md): technical deep-dive

## Getting started

```bash
npm install
npm run dev      # local development server
npm run build    # production build into dist/
npm run gates    # automated checks
```

Requires Node.js 20 or newer.

## Contributing and security

Contributions are welcome. Read [CONTRIBUTING](.github/CONTRIBUTING.md) first. To report a vulnerability, follow [SECURITY](.github/SECURITY.md) and do not open a public issue.

## Disclaimer

ZKHUB is experimental software. Nothing here is financial advice. Third-party token names and prices are unverified. ZKHUB is not affiliated with Robinhood.

## License

[MIT](LICENSE)

# ZKHUB Whitepaper

*Draft v0.1. Describes intent and design direction; features are labelled by status.*

## 1. Abstract

Token launches on public chains reward speed and insider knowledge. Bots buy in the first block, related wallets pose as independent buyers, and participants have no way to check that allocation was fair. ZKHUB is a ZK-native launchpad for Robinhood Chain that replaces trust with verification: launches clear in sealed batches, and the rules they followed can be proven and re-checked by anyone.

## 2. Problem

1. **Ordering advantage.** Whoever lands first in a block gets the best price.
2. **Hidden coordination.** Many wallets funded from one source can look like a crowd.
3. **Opaque allocation.** Buyers cannot confirm that caps and rules were applied evenly.
4. **Unverifiable claims.** "Fair launch" is a marketing phrase, not a checkable property.

## 3. Approach

### 3.1 Sealed batches
Participants submit commitments during a window. Nothing about order or size is usable for front-running until the window closes. The batch then clears together, so position within a block stops mattering.

### 3.2 Launch models
A creator picks one model, and its parameters are fixed in a public manifest before opening:

- **Sealed Book**: commitments cleared at one uniform price, excess refunded.
- **Dutch Descent**: price steps down on a schedule until supply is taken or the floor is reached.
- **Lottery Allocation**: fixed tickets and a verifiable draw; losers refunded in full.
- **Classic Curve**: a bonding curve, for launches that prefer simplicity.

### 3.3 Proofs of fair clearing
Each cleared batch is accompanied by a proof that the clearing followed the manifest: caps applied, one price for all, refunds correct. Public inputs are published with the receipt so any party can re-verify.

### 3.4 Forensics
Wallet-network analysis groups addresses that share a funding source and flags same-block buying. Every finding shows its evidence and data source. Findings are signals, never verdicts.

### 3.5 Optional privacy levels
Creators may choose how much is public: fully public, sealed order book, or shielded balances. Higher levels depend on the proving stack and are previews today.

## 4. Principles

- **Read-only by default.** Browsing needs no wallet.
- **Evidence over assertion.** Show the data behind every claim.
- **Honest status.** Each program is labelled live, testing, preview or planned.
- **Local-first drafts.** Nothing leaves the device until a launch is deliberately deployed.

## 5. Current state

The desktop, live chain data and the launchpad market view are live. The launch form saves local drafts. Deployment, on-chain settlement and proof generation are not live. See the [roadmap](roadmap.md).

## 6. Risks

Smart-contract defects, proving-system bugs, data-provider outages, regulatory change and market risk all apply. ZKHUB is experimental and nothing here is financial advice.

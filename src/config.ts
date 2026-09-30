// Single source of truth for anything that is "inert until stated".
// Leave a value as "" and the matching UI stays inert. Never invent values.
export const CA = ""; // $ZKHUB contract address on Robinhood Chain (absent)
export const CA_DATE = ""; // announcement date; only shown when CA is set
export const X_URL = ""; // https://x.com/zkhubdotxyz once stated
export const GITHUB_URL = ""; // absent

export const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
  llamaName: "Robinhood Chain",
  dexChainId: "robinhood",
} as const;

export const POLL = { blockMs: 4000, marketMs: 60000 } as const;

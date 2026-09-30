import { CHAIN, POLL } from "../config.ts";
import { rpc, parseBlock, parseRpcNumber, parseChainTvl, parsePairs, fetchChains, fetchPairs, type Pair } from "../lib/data.ts";

export interface Live { block: number; gas: number; tvl: number; pairs: Pair[] | null; rpcOk: boolean | null; blockAt: number }
export const live: Live = { block: NaN, gas: NaN, tvl: NaN, pairs: null, rpcOk: null, blockAt: 0 };
const subs = new Set<() => void>();
export const onLive = (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach((f) => f());
let fails = 0;

async function pollBlock() {
  try {
    const [b, g] = await Promise.all([rpc(CHAIN.rpc, "eth_getBlockByNumber", ["latest", false]), rpc(CHAIN.rpc, "eth_gasPrice")]);
    const blk = parseBlock(b);
    if (!blk) throw new Error("bad block");
    fails = 0; live.block = blk.number; live.gas = parseRpcNumber(g); live.rpcOk = true; live.blockAt = Date.now();
  } catch { if (++fails >= 2) live.rpcOk = false; }
  emit();
}
async function pollMarket() {
  try { live.tvl = parseChainTvl(await fetchChains(), CHAIN.llamaName); } catch { /* keep last */ }
  try { live.pairs = parsePairs(await fetchPairs(), CHAIN.dexChainId, 24); } catch { if (!live.pairs) live.pairs = null; }
  emit();
}
let started = false;
export function startLive() {
  if (started) return; started = true;
  pollBlock(); pollMarket();
  setInterval(pollBlock, POLL.blockMs); setInterval(pollMarket, POLL.marketMs);
}

import { hexToNumber } from "./format.ts";

export interface Pair {
  name: string;
  symbol: string;
  address: string;
  dex: string;
  priceUsd: number;
  change24h: number;
  vol24h: number;
  liqUsd: number;
  createdAt: number;
  url: string;
}

export function parseRpcNumber(json: unknown): number {
  const r = (json as { result?: unknown } | null)?.result;
  return hexToNumber(r);
}

export interface Block { number: number; timestamp: number; txs: number }

export function parseBlock(json: unknown): Block | null {
  const r = (json as { result?: any } | null)?.result;
  if (!r || typeof r !== "object") return null;
  const number = hexToNumber(r.number);
  const timestamp = hexToNumber(r.timestamp);
  if (!Number.isFinite(number) || !Number.isFinite(timestamp)) return null;
  return { number, timestamp, txs: Array.isArray(r.transactions) ? r.transactions.length : 0 };
}

export function parseChainTvl(chains: unknown, name: string): number {
  if (!Array.isArray(chains)) return NaN;
  const c = chains.find((x) => x && (x as { name?: string }).name === name) as { tvl?: number } | undefined;
  return typeof c?.tvl === "number" ? c.tvl : NaN;
}

export function parseTvlSeries(rows: unknown, take = 60): number[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => (r as { tvl?: number }).tvl)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .slice(-take);
}

export function parsePairs(json: unknown, chainId: string, take = 8): Pair[] {
  const list = (json as { pairs?: unknown[] } | null)?.pairs;
  if (!Array.isArray(list)) return [];
  const out: Pair[] = [];
  for (const raw of list) {
    const p = raw as any;
    if (!p || p.chainId !== chainId) continue;
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : NaN);
    out.push({
      name: String(p.baseToken?.name ?? "").slice(0, 40),
      symbol: String(p.baseToken?.symbol ?? "").slice(0, 12),
      address: String(p.baseToken?.address ?? ""),
      dex: String(p.dexId ?? ""),
      priceUsd: num(p.priceUsd),
      change24h: num(p.priceChange?.h24),
      vol24h: num(p.volume?.h24),
      liqUsd: num(p.liquidity?.usd),
      createdAt: num(p.pairCreatedAt),
      url: typeof p.url === "string" && p.url.startsWith("https://dexscreener.com/") ? p.url : "",
    });
  }
  out.sort((a, b) => (b.vol24h || 0) - (a.vol24h || 0));
  return out.slice(0, take);
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export function rpc(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  return getJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

export const fetchChains = () => getJson("https://api.llama.fi/v2/chains");
export const fetchTvlHistory = (name: string) =>
  getJson("https://api.llama.fi/v2/historicalChainTvl/" + encodeURIComponent(name));
export const fetchPairs = () => getJson("https://api.dexscreener.com/latest/dex/search?q=robinhood");

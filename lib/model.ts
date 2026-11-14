// Launch Radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// The board is a radar for token launches that have not happened yet. It ranks every protocol that
// still records no token (no market cap, no CoinGecko id, no ticker in the snapshot) and is not a
// wrapped, staked, bridged or versioned product of one that already trades. The snapshot's watchlist
// is the floor: all 40 of its protocols are always on the board. Below the floor the radar keeps
// going, because finding pre-token protocols early is the point of a radar: every other rankable
// pre-token protocol down to the snapshot's own $5M edge joins it, biggest first, up to BOARD_CAP.
//
// The implied value is a comparables model, calibrated by the snapshot itself — no hand-picked
// names, no constants a person chose for one protocol:
//
//   For every category, look at the protocols in the snapshot whose token already trades and take
//   the median of market-cap / TVL across them: that is what the market currently pays for a
//   dollar of TVL in that line of business. A category with few live names is shrunk toward the
//   market-wide median (weight COMPS_PRIOR), and an evidence cap ties it down further: with n
//   live comparables the applied multiple may not exceed (1 + EVIDENCE_CAP_K / sqrt(n)) times
//   the market median, so one rich comparable (the snapshot holds a category whose single live
//   name trades at 400x its TVL) cannot mint a fortune on its own. Every multiple is also
//   clamped to [MULTIPLE_MIN, MULTIPLE_MAX].
//
//   implied = TVL
//           x category multiple (shrunk, clamped)
//           x growth multiplier    1 + GROWTH_WEIGHT x clamp(change_7d, GROWTH_FLOOR, GROWTH_CAP)/100
//           x maturity multiplier  MATURITY_BASE + MATURITY_RANGE x (1 - exp(-age_days / MATURITY_TAU))
//           x breadth multiplier   1 + BREADTH_WEIGHT x min(chains - 1, BREADTH_CHAINS)
//
// Growth says the protocol is gaining or losing the TVL the multiple is applied to. Maturity says
// a protocol that has run for years with no token has proved the record the value rests on; a
// two-week-old protocol has not. Breadth says a protocol already deployed on many chains has more
// surface for a token to be useful across. A protocol DefiLlama has tracked for an unknown time is
// scored at UNKNOWN_AGE_DAYS. The implied value is this board's own claim about what a launch
// would be worth if the record stayed as it is; it is not a prediction that a token will launch.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated in the dashboard so a reader can recompute every row. */
export interface ModelConstants {
  comps_prior: number;
  evidence_cap_k: number;
  multiple_min: number;
  multiple_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_base: number;
  maturity_range: number;
  maturity_tau_days: number;
  unknown_age_days: number;
  breadth_weight: number;
  breadth_chains: number;
}

export const MODEL: ModelConstants = {
  comps_prior: 8,
  evidence_cap_k: 4,
  multiple_min: 0.05,
  multiple_max: 3,
  growth_weight: 0.5,
  growth_floor: -40,
  growth_cap: 100,
  maturity_base: 0.85,
  maturity_range: 0.3,
  maturity_tau_days: 540,
  unknown_age_days: 270,
  breadth_weight: 0.015,
  breadth_chains: 8,
};

/** The model's version label: the dashboard names it and every board row carries it. */
export const MODEL_VERSION = 'launch-radar-2';

/** How many rows the board carries at most: the watchlist plus the early radar below the floor. */
export const BOARD_CAP = 240;

/** How many live-token protocols the dashboard's Already trading view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A calibrated category: its live comparables count and the multiple the board applies. */
export interface CategoryComp {
  category: string;
  live_count: number;
  raw_median: number;
  multiple: number;
}

/** The calibration the whole board shares: the market-wide median and one entry per category. */
export interface Calibration {
  global_median: number;
  live_count: number;
  categories: CategoryComp[];
}

/** One row of board.json: the ranked board's row, with the model's working shown. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_per_tvl: number;
  model: {
    version: string;
    category_multiple: number;
    comps_live: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one board row, farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_per_tvl: number;
  category_multiple: number;
  comps_live: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
}

/** A protocol whose token already trades: the market's own value, never the model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  per_tvl: number | null;
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: { global_median: number; live_count: number; categories: CategoryComp[] };
  protocols_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  pre_token_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when the date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all: no market cap, no CoinGecko id, no ticker. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Names that begin with an exchange's: the exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped, staked or staking, in any case: a product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * Whether a pre-token protocol is one the board may rank: not a product of a trading token, not a
 * versioned pool, not an exchange's own desk. This mirrors the watchlist's own rule, so the early
 * radar below the floor is drawn with the same pencil as the floor itself.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name) || WRAPPED_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The calibration: what the market pays per dollar of TVL, market-wide and per category, read off
 * the snapshot's own live-token protocols. Deterministic: medians of sorted ratios, nothing else.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const ratiosByCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Uncategorised';
    const list = ratiosByCategory.get(key);
    if (list === undefined) ratiosByCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const globalMedian = all.length > 0 ? median(all) : 0.25;
  const categories: CategoryComp[] = [];
  for (const [category, ratios] of ratiosByCategory) {
    const raw = median(ratios);
    const shrunk = (ratios.length * raw + model.comps_prior * globalMedian) / (ratios.length + model.comps_prior);
    const evidenceCap = globalMedian * (1 + model.evidence_cap_k / Math.sqrt(ratios.length));
    const capped = Math.min(shrunk, evidenceCap, model.multiple_max);
    categories.push({
      category,
      live_count: ratios.length,
      raw_median: round4(raw),
      multiple: round4(Math.max(model.multiple_min, capped)),
    });
  }
  categories.sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return { global_median: round4(globalMedian), live_count: all.length, categories };
}

/** The multipliers and implied value one protocol gets under `model` and `calibration`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  calibration: Calibration,
): { implied: number; multiple: number; compsLive: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const comp = calibration.categories.find((c) => c.category === (protocol.category ?? 'Uncategorised'));
  const multiple = comp === undefined ? calibration.global_median : comp.multiple;
  const compsLive = comp === undefined ? 0 : comp.live_count;
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(protocol.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_base + model.maturity_range * (1 - Math.exp(-Math.max(ageForModel, 0) / model.maturity_tau_days));
  const breadthMult = 1 + model.breadth_weight * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_chains);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  return { implied, multiple, compsLive, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Gas for one transaction on a chain, in the ranges the chain's own fees run to. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return '$6 to $15 of gas';
  if (chain === 'Bitcoin' || chain === 'Solana') return '$1 to $4 of gas';
  return '$0.10 to $2 of gas';
}

/** Starter capital for one farm position, scaled to the protocol's own size. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long a position must be held to read as a real user, from the protocol's age. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 540) return 45;
  return 30;
}

/** The core farming action for a category: what a farmer actually does in the app. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend')) return `Supply $${capital} of USDC to ${n} on ${chain}, then borrow about 30% of it back and repay within the week, so the wallet shows both sides of the market.`;
  if (c.includes('cdp') || c.includes('collateral')) return `Open a $${capital} collateral position in ${n} on ${chain}: deposit the collateral, mint a small amount of its debt asset and keep the position healthy.`;
  if (c.includes('dex') || c.includes('derivative') || c.includes('perpetual')) return c.includes('dex')
    ? `Provide $${capital} of liquidity to ${n}'s busiest pool on ${chain} and make two swaps a week through its own interface, not an aggregator.`
    : `Deposit $${capital} of USDC as margin on ${n} and run one small hedged trade a week, sized so a liquidation cannot reach it.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${n} vault on ${chain} and keep the vault shares in the wallet; curators route the capital, the shares are the record.`;
  if (c.includes('restak')) return `Restake $${capital} of liquid staking tokens through ${n} on ${chain} and keep the restaking receipt in the wallet.`;
  if (c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${n} and keep the staking receipt; do not unstake inside the hold window.`;
  if (c.includes('basis') || c.includes('cede')) return `Place $${capital} into ${n}'s basis or CeDeFi strategy on ${chain} and leave the position untouched while it accrues.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${n}'s real-world-asset yield token on ${chain} and hold it; the mint, not a secondary buy, is the qualifying act.`;
  if (c.includes('yield')) return `Deposit $${capital} into ${n}'s main yield vault on ${chain} and keep the shares; harvest nothing inside the first month.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${n} on ${chain} and hold the balance in the farming wallet.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${n}'s chain, then make real transactions there each week: a swap, a transfer and one contract call in its own apps.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${n} twice in the first week, then use the bridged funds in one app on the far side.`;
  if (c.includes('prediction')) return `Fund $${capital} and settle at least three market positions on ${n}; volume that settles is what a points program can count.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${n} on ${chain} and keep the policy to expiry; cover bought and held is the usage record.`;
  if (c.includes('option')) return `Buy one small, far-dated option position on ${n} for about $${Math.max(25, Math.round(capital / 4))} and let it run; premium paid is the activity.`;
  return `Deposit $${capital} of USDC into ${n} on ${chain} through its own app and keep the position open; use the app itself, not a third-party front end.`;
}

/** The weekly qualifying action for a category: small, repeatable, and on the protocol itself. */
function weeklyFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `Repeat one small supply or borrow on ${n} every week and vote in any governance poll it opens.`;
  if (c.includes('dex')) return `Swap a small amount through ${n}'s own interface every week and re-check the pool position's range.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Open and close one small hedged trade on ${n} every week; steady volume, never a single burst.`;
  if (c.includes('chain')) return `Make two or three ordinary transactions on ${n}'s chain every week, on different days.`;
  if (c.includes('bridge')) return `Bridge a small amount through ${n} every second week, alternating direction.`;
  return `Make one qualifying action on ${n} every week: a deposit, a claim, a vote or a small trade inside its own app.`;
}

/** A step as one string: the action, then its cost and its time, within the gate's 20..600 chars. */
export function stepText(step: { text: string; cost: string; time: string }): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check in weekly.`;
  return s;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, derived from the
 * protocol's own record (category, main chain, TVL, age, seven-day move) — never a name list.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const move = p.change_7d === null ? 'unreported' : `${p.change_7d > 0 ? 'up' : 'down'} ${Math.abs(round2(p.change_7d))}% in seven days`;
  const steps = [
    {
      text: `Set up one fresh wallet for ${p.name} alone, fund it from your main wallet, and keep its seed phrase offline; a clean wallet makes the farm readable and caps the blast radius.`,
      cost: `${gas} for the funding transfer`,
      time: '10 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital plus ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyFor(p, chain),
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days without withdrawing: ${p.name} has run ${age === null ? 'for an unreported time' : `${age} days`} with no token recorded, and its TVL is ${move}; snapshots taken weeks apart are what a launch program can reward.`,
      cost: `the $${capital} stays in the position for the whole window`,
      time: `${hold} days`,
    },
    {
      text: `Every two weeks, open ${p.name}'s own points, rewards or governance page and record your standing in the farm log; claim only from a link the protocol itself publishes, and never pay anyone to claim for you.`,
      cost: 'nothing to check; a claim fee asked by a third party is a scam signal',
      time: '10 minutes every two weeks',
    },
    {
      text: `Cap the risk: keep this position under 2% of the funds you farm with, and if ${p.name}'s TVL falls more than 20% in a week or its team announces a token, re-read the plan before adding anything.`,
      cost: 'nothing; the cap is the cost control',
      time: '5 minutes at each two-week check',
    },
    {
      text: `Keep a farm log for ${p.name}: the wallet, every date, amount and transaction hash. If a token launches, the log is how you prove the position was yours and unwind or claim in one sitting.`,
      cost: 'nothing but the log itself',
      time: '5 minutes a week',
    },
  ];
  return steps.map(stepText);
}

/** The protocols the board ranks, most valuable first, with ranks 1..n and the model shown. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = calibrate(snapshot, model);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is chosen before anything below it is considered.
  for (const p of snapshot.protocols) if (watch.has(p.slug)) chosen.set(p.slug, p);
  // The early radar: every other rankable pre-token protocol, biggest TVL first, to the cap.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) {
    if (chosen.size >= BOARD_CAP) break;
    chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, calibration);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_per_tvl: round4(s.implied / s.p.tvl_usd),
    model: {
      version: MODEL_VERSION,
      category_multiple: s.multiple,
      comps_live: s.compsLive,
      growth_pct: round2(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Already trading view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      per_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** One board row's compact form for data.js: everything the page renders, farm plan included. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    watchlist: row.watchlist,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_per_tvl: row.implied_per_tvl,
    category_multiple: row.model.category_multiple,
    comps_live: row.model.comps_live,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders and the board carries, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const calibration = calibrate(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration: { global_median: calibration.global_median, live_count: calibration.live_count, categories: calibration.categories },
    protocols_size: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watch.has(r.slug)).length,
    live_size: live.length,
    pre_token_size: snapshot.protocols.filter(isPreToken).length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null. Mirrors the gate's seven rows where local. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

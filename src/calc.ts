import type { Holding, Cloud } from './store';

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + f(x), 0);

// Average-cost method: all buys (including fees) form the average cost per unit.
export function summarize(h: Holding) {
  const boughtQty = sum(h.buys, (b) => b.qty);
  const boughtCost = sum(h.buys, (b) => b.qty * b.price + b.fee);
  const soldQty = sum(h.sells, (s) => s.qty);
  const avgCost = boughtQty > 0 ? boughtCost / boughtQty : 0;
  const qty = boughtQty - soldQty;
  const costBasis = qty * avgCost;
  const hasPrice = h.currentPrice > 0;
  const value = hasPrice ? qty * h.currentPrice : costBasis;
  const unrealized = value - costBasis;
  const unrealizedPct = costBasis > 0 ? (unrealized / costBasis) * 100 : 0;
  const realized = sum(h.sells, (s) => s.qty * s.price - s.fee - s.qty * avgCost);
  const dividends = sum(h.dividends, (d) => d.amount);
  return { qty, avgCost, costBasis, value, unrealized, unrealizedPct, realized, dividends,
    totalReturn: unrealized + realized + dividends };
}

export const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

// Estimated Cloud balance today: base balance grown daily (compounded) at the annual yield.
export function cloudNow(c: Cloud) {
  const r = (c.rate || 0) / 100;
  if (!c.baseDate || r <= 0) return c.balance;
  const days = Math.max(0, Math.floor((Date.now() - new Date(c.baseDate).getTime()) / 86400000));
  return c.balance * Math.pow(1 + r / 365, days);
}

// Expected earning over the next 30 days.
export function cloudMonthly(c: Cloud) {
  const r = (c.rate || 0) / 100;
  return r > 0 ? cloudNow(c) * (Math.pow(1 + r / 365, 30) - 1) : 0;
}

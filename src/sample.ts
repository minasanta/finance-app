import { State, Holding, Trade, uid } from './store';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export function sampleState(): State {
  const today = new Date().getDate();
  // keep example expenses inside the current month
  const back = (n: number) => daysAgo(Math.min(n, Math.max(today - 1, 0)));
  const exp = (category: string, note: string, amount: number, d: number) =>
    ({ id: uid(), date: back(d), category, note, amount });
  const trade = (qty: number, price: number, fee: number, d: number): Trade =>
    ({ id: uid(), date: daysAgo(d), qty, price, fee });
  const holding = (h: Partial<Holding> & Pick<Holding, 'kind' | 'name' | 'currentPrice' | 'buys'>): Holding => ({
    id: uid(), sells: [], dividends: [], reason: '', target: 0, stop: 0, priceUpdated: daysAgo(2), ...h,
  });

  return {
    income: 25000,
    allowance: 8000,
    clouds: [
      { id: uid(), name: 'Emergency fund', kind: 'monthly', balance: 30000, baseDate: daysAgo(20), rate: 24 },
      { id: uid(), name: 'Car', kind: 'monthly', balance: 40000, baseDate: daysAgo(35), rate: 24 },
      { id: uid(), name: 'Weekly reserve', kind: 'instant', balance: 5000, baseDate: daysAgo(10), rate: 22 },
    ],
    expenses: [
      exp('Food - Work', 'Lunch', 120, 0),
      exp('Transport - Work', 'Uber to office', 85, 0),
      exp('Food - Work', 'Coffee and sandwich', 75, 1),
      exp('Food - Home', 'Groceries', 640, 1),
      exp('Transport - Work', 'Metro and microbus', 40, 2),
      exp('Going out', 'Dinner with friends', 520, 2),
      exp('Clothes', 'Jeans', 950, 3),
      exp('Food - Work', 'Lunch', 110, 3),
      exp('Transport - Personal', 'Uber to friend', 130, 4),
      exp('Home items', 'Kitchen organizer', 380, 5),
      exp('Food - Home', 'Pharmacy and groceries', 410, 6),
      exp('Food - Work', 'Lunch', 130, 6),
      exp('Going out', 'Cinema', 260, 7),
      exp('Transport - Work', 'Uber to office', 90, 8),
      exp('Other', 'Phone accessories', 300, 9),
      exp('Food - Work', 'Lunch and coffee', 160, 10),
      exp('Clothes', 'T-shirts', 600, 12),
      exp('Food - Home', 'Groceries', 720, 13),
      exp('Transport - Personal', 'Fuel', 450, 14),
      exp('Going out', 'Restaurant', 480, 15),
    ],
    installments: [
      { id: uid(), name: 'Phone', amount: 1500, total: 12, paid: 5, dayOfMonth: 5 },
      { id: uid(), name: 'Laptop', amount: 2200, total: 10, paid: 3, dayOfMonth: 15 },
    ],
    holdings: [
      holding({
        kind: 'stock', name: 'COMI', currentPrice: 91.2,
        buys: [trade(100, 78.5, 40, 150), trade(50, 82, 22, 70)],
        dividends: [{ id: uid(), date: daysAgo(60), amount: 360 }],
        reason: 'Strong banking sector and regular dividends', target: 105, stop: 72,
      }),
      holding({
        kind: 'stock', name: 'TMGH', currentPrice: 47.8,
        buys: [trade(200, 52, 55, 90)],
        reason: 'Real estate growth story', target: 62, stop: 44,
      }),
      holding({
        kind: 'stock', name: 'FWRY', currentPrice: 20.1,
        buys: [trade(300, 18.4, 28, 40)],
        reason: 'Fintech growth', target: 25, stop: 16,
      }),
      holding({
        kind: 'stock', name: 'EAST', currentPrice: 33,
        buys: [trade(80, 31, 15, 120)],
        sells: [trade(30, 36, 10, 30)],
        reason: 'Stable dividends',
      }),
      holding({
        kind: 'stock', name: 'ABUK', currentPrice: 70,
        buys: [trade(60, 62, 25, 100)],
        sells: [trade(60, 70, 28, 20)],
      }),
      holding({
        kind: 'gold', name: 'Gold 21K', currentPrice: 4380,
        buys: [trade(25, 3900, 487.5, 200), trade(10, 4250, 212.5, 45)],
        reason: 'Hedge against inflation', target: 4800,
      }),
      holding({
        kind: 'silver', name: 'Silver', currentPrice: 61,
        buys: [trade(300, 55, 82.5, 80)],
        reason: 'Small diversification',
      }),
    ],
  };
}

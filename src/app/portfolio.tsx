import React, { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { useStore, uid, num, fmt } from '../store';
import { summarize, pct } from '../calc';
import { loadSettings, searchPrices, PriceResult } from '../ai';
import HoldingDetail from '../HoldingDetail';
import { Screen, Card, Input, Button, Chips, Line, colors } from '../ui';

const KINDS = [
  { value: 'stock', label: 'Stock' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
];
const pl = (n: number) => (n < 0 ? colors.danger : colors.primary);

export default function Portfolio() {
  const { state, setState } = useStore();
  const [kind, setKind] = useState('stock');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [found, setFound] = useState<PriceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const rows = state.holdings.map((h) => ({ h, s: summarize(h) }));
  const open = rows.filter((r) => r.s.qty > 1e-9);
  const closed = rows.filter((r) => r.s.qty <= 1e-9);
  const invested = rows.reduce((a, r) => a + r.s.costBasis, 0);
  const value = rows.reduce((a, r) => a + r.s.value, 0);
  const unrealized = value - invested;
  const realized = rows.reduce((a, r) => a + r.s.realized, 0);
  const dividends = rows.reduce((a, r) => a + r.s.dividends, 0);

  const add = () => {
    if (!name.trim() || num(qty) <= 0 || num(price) <= 0) return;
    setState((s) => ({
      ...s,
      holdings: [...s.holdings, {
        id: uid(), kind: kind as any, name: name.trim(), currentPrice: num(price),
        buys: [{ id: uid(), date: new Date().toISOString(), qty: num(qty), price: num(price), fee: kind === 'stock' ? num(fee) : (num(qty) * num(price) * num(fee)) / 100 }],
        sells: [], dividends: [], reason: '', target: 0, stop: 0,
      }],
    }));
    setName(''); setQty(''); setPrice(''); setFee('');
  };

  const runSearch = async () => {
    setSearching(true); setSearchErr(''); setFound(null);
    try {
      const cfg = await loadSettings();
      setFound(await searchPrices(cfg, open.map((r) => ({ name: r.h.name, kind: r.h.kind }))));
    } catch (e: any) {
      setSearchErr(e?.message || String(e));
    }
    setSearching(false);
  };
  const priceFor = (name: string) => found?.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
  const applyFound = () => {
    setState((s) => ({
      ...s,
      holdings: s.holdings.map((h) => {
        const f = priceFor(h.name);
        return f && f.price ? { ...h, currentPrice: f.price, priceUpdated: new Date().toISOString() } : h;
      }),
    }));
    setFound(null);
  };

  const savePrices = () => {
    setState((s) => ({
      ...s,
      holdings: s.holdings.map((h) => {
        const p = num(prices[h.id] || '');
        return p > 0 ? { ...h, currentPrice: p, priceUpdated: new Date().toISOString() } : h;
      }),
    }));
    setPrices({});
  };

  if (openId) return <HoldingDetail id={openId} onBack={() => setOpenId(null)} />;

  return (
    <Screen>
      <Card title="Portfolio summary">
        <Line label="Invested (cost of what you hold)" value={fmt(invested)} />
        <Line label="Current value" value={fmt(value)} bold />
        <Line label="Unrealized profit / loss" value={`${fmt(unrealized)} (${pct(invested > 0 ? (unrealized / invested) * 100 : 0)})`} bold color={pl(unrealized)} />
        <Line label="Realized profit / loss (sold)" value={fmt(realized)} color={pl(realized)} />
        <Line label="Dividends received" value={fmt(dividends)} />
      </Card>

      {open.map(({ h, s }) => (
        <Pressable key={h.id} onPress={() => setOpenId(h.id)}>
          <Card>
            <Line label={`${h.name} (${h.kind})`} value={fmt(s.value)} bold />
            <Line label={`Qty ${s.qty} - avg cost ${s.avgCost.toFixed(2)}`} value={`now ${h.currentPrice}`} />
            <Line label="Profit / loss" value={`${fmt(s.unrealized)} (${pct(s.unrealizedPct)})`} color={pl(s.unrealized)} bold />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Tap for details</Text>
          </Card>
        </Pressable>
      ))}

      {open.length > 0 ? (
        <Card title="Update prices with AI web search">
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Uses the AI provider and model you picked in the AI tab to search the web for the latest prices. Check the results before applying, because web data can be wrong or delayed.
          </Text>
          <Button title={searching ? 'Searching... (up to a minute)' : 'Search latest prices'} onPress={runSearch} />
          {searchErr ? <Text style={{ color: colors.danger }}>{searchErr}</Text> : null}
          {found ? (
            <View style={{ gap: 6 }}>
              {open.map(({ h }) => {
                const f = priceFor(h.name);
                return (
                  <View key={h.id}>
                    <Line label={h.name} value={f && f.price ? `${h.currentPrice} → ${f.price}` : 'not found'} bold color={f && f.price ? colors.primary : colors.muted} />
                    {f && f.price ? <Text style={{ color: colors.muted, fontSize: 12 }}>{[f.asOf, f.source].filter(Boolean).join(' - ')}</Text> : null}
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button flex title="Apply prices" onPress={applyFound} />
                <Button flex title="Discard" color="#374151" onPress={() => setFound(null)} />
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {open.length > 0 ? (
        <Card title="Update current prices">
          {open.map(({ h }) => (
            <Input key={h.id} label={`${h.name} (now ${h.currentPrice})`} keyboardType="numeric"
              value={prices[h.id] || ''} onChangeText={(t) => setPrices((p) => ({ ...p, [h.id]: t }))}
              placeholder="New price per unit" />
          ))}
          <Button title="Save prices" onPress={savePrices} />
        </Card>
      ) : null}

      {closed.length > 0 ? (
        <Card title="Sold positions">
          {closed.map(({ h, s }) => (
            <Pressable key={h.id} onPress={() => setOpenId(h.id)}>
              <Line label={`${h.name} - sold`} value={fmt(s.realized)} color={pl(s.realized)} bold />
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card title="Add a holding (first purchase)">
        <Chips options={KINDS} value={kind} onChange={setKind} />
        <Input label="Symbol or name (e.g. COMI, Gold 21K)" value={name} onChangeText={setName} autoCapitalize="characters" />
        <Input label={kind === 'stock' ? 'Quantity (shares)' : 'Weight (grams)'} keyboardType="numeric" value={qty} onChangeText={setQty} />
        <Input label={kind === 'stock' ? 'Buy price per share' : 'Buy price per gram'} keyboardType="numeric" value={price} onChangeText={setPrice} />
        <Input label={kind === 'stock' ? 'Fees paid (optional)' : 'Fees (% of the value, optional)'} keyboardType="numeric" value={fee} onChangeText={setFee} />
        <Button title="Add" onPress={add} />
      </Card>
    </Screen>
  );
}

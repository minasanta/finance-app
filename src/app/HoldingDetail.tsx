import React, { useState } from 'react';
import { Text, View, Pressable, Alert } from 'react-native';
import { useStore, uid, num, fmt, Holding } from './store';
import { summarize, pct } from './calc';
import { Screen, Card, Input, Button, Line, colors } from './ui';

export default function HoldingDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { state, setState } = useStore();
  const h = state.holdings.find((x) => x.id === id);

  const [price, setPrice] = useState('');
  const [bq, setBq] = useState(''); const [bp, setBp] = useState(''); const [bf, setBf] = useState('');
  const [sq, setSq] = useState(''); const [sp, setSp] = useState(h ? String(h.currentPrice) : ''); const [sf, setSf] = useState('');
  const [div, setDiv] = useState('');
  const [reason, setReason] = useState(h?.reason ?? '');
  const [target, setTarget] = useState(h?.target ? String(h.target) : '');
  const [stop, setStop] = useState(h?.stop ? String(h.stop) : '');

  if (!h) {
    return (
      <Screen>
        <Button title="Back to portfolio" onPress={() => onBack()} />
        <Text>Holding not found.</Text>
      </Screen>
    );
  }

  const s = summarize(h);
  const isMetal = h.kind !== 'stock';
  // gold and silver: the fee is typed as a percentage of the trade value and stored as an amount
  const feeOf = (q: number, p: number, f: string) => (isMetal ? (q * p * num(f)) / 100 : num(f));
  const upd = (fn: (x: Holding) => Holding) =>
    setState((st) => ({ ...st, holdings: st.holdings.map((x) => (x.id === h.id ? fn(x) : x)) }));
  const now = () => new Date().toISOString();
  const color = (n: number) => (n < 0 ? colors.danger : colors.primary);

  const buy = () => {
    if (num(bq) <= 0 || num(bp) <= 0) return;
    upd((x) => ({ ...x, buys: [...x.buys, { id: uid(), date: now(), qty: num(bq), price: num(bp), fee: feeOf(num(bq), num(bp), bf) }] }));
    setBq(''); setBp(''); setBf('');
  };
  const sell = () => {
    if (num(sq) <= 0 || num(sp) <= 0) return;
    if (num(sq) > s.qty) { Alert.alert('You cannot sell more than you hold'); return; }
    upd((x) => ({ ...x, currentPrice: num(sp), priceUpdated: now(), sells: [...x.sells, { id: uid(), date: now(), qty: num(sq), price: num(sp), fee: feeOf(num(sq), num(sp), sf) }] }));
    setSq(''); setSf('');
  };
  const sellAll = () => {
    const p = num(sp) > 0 ? num(sp) : h.currentPrice;
    if (s.qty <= 1e-9 || p <= 0) return;
    upd((x) => ({ ...x, currentPrice: p, priceUpdated: now(), sells: [...x.sells, { id: uid(), date: now(), qty: s.qty, price: p, fee: feeOf(s.qty, p, sf) }] }));
    setSq(''); setSf('');
  };
  const remove = () =>
    Alert.alert('Delete', `Delete ${h.name} and all its history?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setState((st) => ({ ...st, holdings: st.holdings.filter((x) => x.id !== h.id) }));
        onBack();
      } },
    ]);

  const toTarget = h.target > 0 && h.currentPrice > 0 ? ((h.target - h.currentPrice) / h.currentPrice) * 100 : null;
  const toStop = h.stop > 0 && h.currentPrice > 0 ? ((h.stop - h.currentPrice) / h.currentPrice) * 100 : null;

  return (
    <Screen>
      <Button title="Back to portfolio" color="#374151" onPress={() => onBack()} />

      <Card title={`${h.name} (${h.kind})`}>
        <Line label="Holding" value={`${s.qty} ${h.kind === 'stock' ? 'shares' : 'g'}`} />
        <Line label="Average cost (incl. fees)" value={s.avgCost.toFixed(2)} />
        <Line label="Cost of what you hold" value={fmt(s.costBasis)} />
        <Line label="Current price" value={String(h.currentPrice)} />
        <Line label="Current value" value={fmt(s.value)} bold />
        <Line label="Unrealized profit / loss" value={`${fmt(s.unrealized)} (${pct(s.unrealizedPct)})`} bold color={color(s.unrealized)} />
        <Line label="Realized profit / loss" value={fmt(s.realized)} color={color(s.realized)} />
        <Line label="Dividends" value={fmt(s.dividends)} />
        <Line label="Total return" value={fmt(s.totalReturn)} bold color={color(s.totalReturn)} />
        {s.qty <= 1e-9 ? <Text style={{ color: colors.muted }}>Position closed - fully sold</Text> : null}
        {h.priceUpdated ? <Text style={{ color: colors.muted, fontSize: 12 }}>Price updated {h.priceUpdated.slice(0, 10)}</Text> : null}
      </Card>

      <Card title="Buy more">
        <Input label="Quantity" keyboardType="numeric" value={bq} onChangeText={setBq} />
        <Input label="Price per unit" keyboardType="numeric" value={bp} onChangeText={setBp} />
        <Input label={isMetal ? 'Fees (% of the value, optional)' : 'Fees (optional)'} keyboardType="numeric" value={bf} onChangeText={setBf} />
        <Button title="Add purchase" onPress={buy} />
      </Card>

      <Card title="Sell">
        <Input label="Quantity" keyboardType="numeric" value={sq} onChangeText={setSq} />
        <Input label="Sell price per unit (starts at the latest price)" keyboardType="numeric" value={sp} onChangeText={setSp} />
        <Input label={isMetal ? 'Fees (% of the value, optional)' : 'Fees (optional)'} keyboardType="numeric" value={sf} onChangeText={setSf} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button flex title="Sell this quantity" color="#B45309" onPress={sell} />
          <Button flex title="Sell all" color={colors.danger} onPress={sellAll} />
        </View>
      </Card>

      <Card title="Update current price">
        <Input keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="Price per unit" />
        <Button title="Save price" onPress={() => { if (num(price) > 0) { upd((x) => ({ ...x, currentPrice: num(price), priceUpdated: now() })); setPrice(''); } }} />
      </Card>

      <Card title="Decision notes">
        <Input label="Why did you buy it?" value={reason} onChangeText={setReason} multiline />
        <Input label="Target price" keyboardType="numeric" value={target} onChangeText={setTarget} />
        <Input label="Stop-loss price" keyboardType="numeric" value={stop} onChangeText={setStop} />
        {toTarget !== null ? <Line label="Distance to target" value={pct(toTarget)} /> : null}
        {toStop !== null ? <Line label="Distance to stop-loss" value={pct(toStop)} /> : null}
        <Button title="Save notes" onPress={() => upd((x) => ({ ...x, reason, target: num(target), stop: num(stop) }))} />
      </Card>

      <Card title="Dividend received">
        <Input keyboardType="numeric" value={div} onChangeText={setDiv} placeholder="Amount" />
        <Button title="Add dividend" onPress={() => { if (num(div) > 0) { upd((x) => ({ ...x, dividends: [...x.dividends, { id: uid(), date: now(), amount: num(div) }] })); setDiv(''); } }} />
      </Card>

      <Card title="History">
        {h.buys.map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ flex: 1 }}>Buy {b.qty} @ {b.price} (fee {Number(b.fee.toFixed(2))}) - {b.date.slice(0, 10)}</Text>
            <Pressable onPress={() => upd((x) => ({ ...x, buys: x.buys.filter((y) => y.id !== b.id) }))}>
              <Text style={{ color: colors.danger, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        ))}
        {h.sells.map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ flex: 1 }}>Sell {b.qty} @ {b.price} (fee {Number(b.fee.toFixed(2))}) - {b.date.slice(0, 10)}</Text>
            <Pressable onPress={() => upd((x) => ({ ...x, sells: x.sells.filter((y) => y.id !== b.id) }))}>
              <Text style={{ color: colors.danger, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        ))}
        {h.dividends.map((d) => (
          <View key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ flex: 1 }}>Dividend {d.amount} - {d.date.slice(0, 10)}</Text>
            <Pressable onPress={() => upd((x) => ({ ...x, dividends: x.dividends.filter((y) => y.id !== d.id) }))}>
              <Text style={{ color: colors.danger, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Button title="Delete this holding" color={colors.danger} onPress={remove} />
    </Screen>
  );
}

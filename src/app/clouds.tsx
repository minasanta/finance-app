import React, { useState } from 'react';
import { Text, Alert, View } from 'react-native';
import { useStore, uid, num, fmt, Cloud, CloudKind } from '../store';
import { cloudNow, cloudMonthly } from '../calc';
import { loadSettings, searchYields, YieldResult } from '../ai';
import { Screen, Card, Input, Button, Chips, Line, colors } from '../ui';

const KINDS = [
  { value: 'instant', label: 'Weekly (Instant)' },
  { value: 'monthly', label: 'Monthly' },
];
const kindLabel = (k: string) => (k === 'instant' ? 'Weekly (Instant)' : k === 'monthly' ? 'Monthly' : k);
const nowIso = () => new Date().toISOString();

function CloudRow({ c }: { c: Cloud }) {
  const { setState } = useStore();
  const [amt, setAmt] = useState('');
  const [rate, setRate] = useState(c.rate ? String(c.rate) : '');
  const now = cloudNow(c);

  // lock in today's estimated balance, then apply the change
  const change = (fn: (cur: number) => number) =>
    setState((s) => ({ ...s, clouds: s.clouds.map((x) => (x.id === c.id ? { ...x, balance: fn(cloudNow(x)), baseDate: nowIso() } : x)) }));

  const deposit = () => { if (num(amt) > 0) { change((cur) => cur + num(amt)); setAmt(''); } };
  const withdraw = () => {
    const a = num(amt);
    if (a <= 0) return;
    if (a > now) { Alert.alert('Not enough balance'); return; }
    change((cur) => cur - a);
    setAmt('');
  };
  const saveRate = () =>
    setState((s) => ({ ...s, clouds: s.clouds.map((x) => (x.id === c.id ? { ...x, balance: cloudNow(x), baseDate: nowIso(), rate: num(rate) } : x)) }));
  const remove = () =>
    Alert.alert('Delete', `Delete "${c.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setState((s) => ({ ...s, clouds: s.clouds.filter((x) => x.id !== c.id) })) },
    ]);

  return (
    <Card title={`${c.name} (${kindLabel(c.kind)})`}>
      <Line label="Estimated balance now" value={fmt(now)} bold />
      <Line label="Earned since last update" value={fmt(now - c.balance)} color={colors.primary} />
      <Line label="Annual yield" value={c.rate ? `${c.rate}%` : 'not set'} />
      <Line label="Expected in the next 30 days" value={fmt(cloudMonthly(c))} />
      {c.baseDate ? <Text style={{ color: colors.muted, fontSize: 12 }}>Last updated {c.baseDate.slice(0, 10)}</Text> : null}
      {c.kind === 'monthly' ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Monthly: free withdrawal if scheduled before the last Sunday of the month; instant withdrawal costs 0.25%.
        </Text>
      ) : null}
      <Input keyboardType="numeric" value={amt} onChangeText={setAmt} placeholder="Amount" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button flex title="Deposit" onPress={deposit} />
        <Button flex title="Withdraw" color="#B45309" onPress={withdraw} />
      </View>
      <Input label="Annual yield % (from Thndr)" keyboardType="numeric" value={rate} onChangeText={setRate} placeholder="e.g. 24" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button flex title="Save yield" color="#374151" onPress={saveRate} />
        <Button flex title="Delete" color={colors.danger} onPress={remove} />
      </View>
    </Card>
  );
}

export default function Clouds() {
  const { state, setState } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>('instant');
  const [start, setStart] = useState('');
  const [rate, setRate] = useState('');
  const [found, setFound] = useState<YieldResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [actual, setActual] = useState<Record<string, string>>({});

  const total = state.clouds.reduce((a, c) => a + cloudNow(c), 0);
  const monthly = state.clouds.reduce((a, c) => a + cloudMonthly(c), 0);

  const runSearch = async () => {
    setSearching(true); setSearchErr(''); setFound(null);
    try {
      const cfg = await loadSettings();
      setFound(await searchYields(cfg, state.clouds.map((c) => ({ name: c.name, kind: c.kind }))));
    } catch (e: any) {
      setSearchErr(e?.message || String(e));
    }
    setSearching(false);
  };
  const yieldFor = (name: string) => found?.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
  const applyYields = () => {
    setState((s) => ({
      ...s,
      clouds: s.clouds.map((c) => {
        const f = yieldFor(c.name);
        return f && f.rate ? { ...c, balance: cloudNow(c), baseDate: nowIso(), rate: f.rate } : c;
      }),
    }));
    setFound(null);
  };

  const add = () => {
    if (!name.trim()) return;
    setState((s) => ({
      ...s,
      clouds: [...s.clouds, { id: uid(), name: name.trim(), kind: kind as CloudKind, balance: num(start), baseDate: nowIso(), rate: num(rate) }],
    }));
    setName(''); setStart(''); setRate('');
  };

  const sync = () => {
    setState((s) => ({
      ...s,
      clouds: s.clouds.map((c) => {
        const t = actual[c.id];
        return t !== undefined && t !== '' ? { ...c, balance: num(t), baseDate: nowIso() } : c;
      }),
    }));
    setActual({});
  };

  return (
    <Screen>
      <Card title="Savings total">
        <Line label="Estimated total now" value={fmt(total)} bold />
        <Line label="Expected earnings, next 30 days" value={fmt(monthly)} color={colors.primary} />
      </Card>

      {state.clouds.length > 0 ? (
        <Card title="Find current yields with AI web search">
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Uses the AI provider and model you picked in the AI tab to look up current Cloud yields online. Check them against the Thndr app before applying.
          </Text>
          <Button title={searching ? 'Searching... (up to a minute)' : 'Search current yields'} onPress={runSearch} />
          {searchErr ? <Text style={{ color: colors.danger }}>{searchErr}</Text> : null}
          {found ? (
            <View style={{ gap: 6 }}>
              {state.clouds.map((c) => {
                const f = yieldFor(c.name);
                return (
                  <View key={c.id}>
                    <Line label={c.name} value={f && f.rate ? `${c.rate || 0}% → ${f.rate}%` : 'not found'} bold color={f && f.rate ? colors.primary : colors.muted} />
                    {f && f.rate && f.source ? <Text style={{ color: colors.muted, fontSize: 12 }}>{f.source}</Text> : null}
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button flex title="Apply yields" onPress={applyYields} />
                <Button flex title="Discard" color="#374151" onPress={() => setFound(null)} />
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {state.clouds.length > 0 ? (
        <Card title="Match with Thndr">
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Type the real balance shown in Thndr to correct the estimate. Leave a box empty to keep it.
          </Text>
          {state.clouds.map((c) => (
            <Input key={c.id} label={`${c.name} (estimated ${Math.round(cloudNow(c)).toLocaleString('en-US')})`}
              keyboardType="numeric" value={actual[c.id] || ''}
              onChangeText={(t) => setActual((p) => ({ ...p, [c.id]: t }))} placeholder="Real balance" />
          ))}
          <Button title="Save balances" onPress={sync} />
        </Card>
      ) : null}

      {state.clouds.map((c) => <CloudRow key={c.id} c={c} />)}

      <Card title="New Cloud">
        <Input label="Name (e.g. Emergency, Car)" value={name} onChangeText={setName} />
        <Chips options={KINDS} value={kind} onChange={setKind} />
        <Input label="Current balance" keyboardType="numeric" value={start} onChangeText={setStart} placeholder="0" />
        <Input label="Annual yield % (optional)" keyboardType="numeric" value={rate} onChangeText={setRate} placeholder="e.g. 24" />
        <Button title="Add" onPress={add} />
      </Card>
    </Screen>
  );
}

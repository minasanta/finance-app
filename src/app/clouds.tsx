import React, { useState } from 'react';
import { Text, Alert, View } from 'react-native';
import { useStore, uid, num, fmt, Cloud, CloudKind } from '../../src/store';
import { Screen, Card, Input, Button, Chips, Line, colors } from '../../src/ui';

const KINDS = [
  { value: 'instant', label: 'Weekly (Instant)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'gold', label: 'Gold / Silver' },
  { value: 'stocks', label: 'Stocks' },
];
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label || k;

function CloudRow({ c }: { c: Cloud }) {
  const { setState } = useStore();
  const [amt, setAmt] = useState('');

  const update = (fn: (b: number, a: number) => number) => {
    const a = num(amt);
    if (a <= 0 && fn(0, 0) !== 0) return;
    setState((s) => ({ ...s, clouds: s.clouds.map((x) => (x.id === c.id ? { ...x, balance: fn(x.balance, a) } : x)) }));
    setAmt('');
  };
  const withdraw = () => {
    const a = num(amt);
    if (a <= 0) return;
    if (a > c.balance) { Alert.alert('Not enough balance'); return; }
    update((b, x) => b - x);
  };
  const remove = () =>
    Alert.alert('Delete', `Delete "${c.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setState((s) => ({ ...s, clouds: s.clouds.filter((x) => x.id !== c.id) })) },
    ]);

  return (
    <Card>
      <Line label={`${c.name} (${kindLabel(c.kind)})`} value={fmt(c.balance)} bold />
      {c.kind === 'monthly' ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Monthly: free withdrawal if scheduled before the last Sunday of the month; instant withdrawal costs 0.25%.
        </Text>
      ) : null}
      <Input keyboardType="numeric" value={amt} onChangeText={setAmt} placeholder="Amount" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button flex title="Deposit" onPress={() => update((b, a) => b + a)} />
        <Button flex title="Withdraw" color="#B45309" onPress={withdraw} />
        <Button flex title="Set balance" color="#374151" onPress={() => num(amt) >= 0 && amt !== '' && update((_b, a) => a)} />
      </View>
      <Button title="Delete" color={colors.danger} onPress={remove} />
    </Card>
  );
}

export default function Clouds() {
  const { state, setState } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>('instant');

  const add = () => {
    if (!name.trim()) return;
    setState((s) => ({ ...s, clouds: [...s.clouds, { id: uid(), name: name.trim(), kind: kind as CloudKind, balance: 0 }] }));
    setName('');
  };

  return (
    <Screen>
      <Card title="New saving bucket">
        <Input label="Name (e.g. Car, Emergency)" value={name} onChangeText={setName} />
        <Chips options={KINDS} value={kind} onChange={setKind} />
        <Button title="Add" onPress={add} />
      </Card>
      {state.clouds.map((c) => <CloudRow key={c.id} c={c} />)}
    </Screen>
  );
}

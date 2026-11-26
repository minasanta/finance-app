import React, { useState } from 'react';
import { Text, View, Alert } from 'react-native';
import { useStore, uid, num, fmt, curMonth, Installment } from '../../src/store';
import { Screen, Card, Input, Button, Line, colors } from '../../src/ui';

function endDate(i: Installment) {
  const left = i.total - i.paid;
  if (left <= 0) return 'Done';
  const now = new Date();
  const base = i.lastPaid === curMonth() ? 1 : 0;
  const d = new Date(now.getFullYear(), now.getMonth() + base + left - 1, i.dayOfMonth || 1);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function Installments() {
  const { state, setState } = useStore();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('0');
  const [day, setDay] = useState('1');

  const add = () => {
    if (!name.trim() || num(amount) <= 0 || num(total) <= 0) return;
    const inst: Installment = {
      id: uid(), name: name.trim(), amount: num(amount), total: Math.round(num(total)),
      paid: Math.round(num(paid)), dayOfMonth: Math.min(Math.max(Math.round(num(day)) || 1, 1), 28),
    };
    setState((s) => ({ ...s, installments: [...s.installments, inst] }));
    setName(''); setAmount(''); setTotal(''); setPaid('0'); setDay('1');
  };
  const markPaid = (id: string) =>
    setState((s) => ({ ...s, installments: s.installments.map((i) =>
      i.id === id && i.paid < i.total ? { ...i, paid: i.paid + 1, lastPaid: curMonth() } : i) }));
  const remove = (i: Installment) =>
    Alert.alert('Delete', `Delete "${i.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setState((s) => ({ ...s, installments: s.installments.filter((x) => x.id !== i.id) })) },
    ]);

  return (
    <Screen>
      <Card title="New installment">
        <Input label="What is it?" value={name} onChangeText={setName} />
        <Input label="Monthly amount" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <Input label="Total number of installments" keyboardType="numeric" value={total} onChangeText={setTotal} />
        <Input label="Already paid" keyboardType="numeric" value={paid} onChangeText={setPaid} />
        <Input label="Due day of month (1-28)" keyboardType="numeric" value={day} onChangeText={setDay} />
        <Button title="Add" onPress={add} />
      </Card>

      {state.installments.map((i) => (
        <Card key={i.id}>
          <Line label={i.name} value={fmt(i.amount) + ' / month'} bold />
          <Line label="Paid" value={`${i.paid} of ${i.total}`} />
          <Line label="Remaining amount" value={fmt(Math.max(i.total - i.paid, 0) * i.amount)} />
          <Line label="Ends around" value={endDate(i)} color={colors.primary} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button flex title="Mark this month paid" onPress={() => markPaid(i.id)} />
            <Button title="Delete" color={colors.danger} onPress={() => remove(i)} />
          </View>
        </Card>
      ))}
      {state.installments.length === 0 ? <Text style={{ color: colors.muted }}>No installments yet.</Text> : null}
    </Screen>
  );
}

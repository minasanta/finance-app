import React, { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { useStore, uid, num, fmt, curMonth } from '../../src/store';
import { Screen, Card, Input, Button, Chips, Line, colors } from '../../src/ui';

const CATS = ['Food - Work', 'Food - Home', 'Transport - Work', 'Transport - Personal',
  'Clothes', 'Home items', 'Going out', 'Other'].map((c) => ({ value: c, label: c }));

export default function Expenses() {
  const { state, setState } = useStore();
  const [cat, setCat] = useState('Food - Work');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');

  const month = state.expenses.filter((e) => e.date.slice(0, 7) === curMonth())
    .sort((a, b) => b.date.localeCompare(a.date));
  const byCat: Record<string, number> = {};
  month.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

  const add = () => {
    const a = num(amount);
    if (a <= 0) return;
    setState((s) => ({ ...s, expenses: [...s.expenses, { id: uid(), date: new Date().toISOString(), category: cat, note: note.trim(), amount: a }] }));
    setNote(''); setAmount('');
  };

  return (
    <Screen>
      <Card title="Add expense">
        <Chips options={CATS} value={cat} onChange={setCat} />
        <Input label="What did you buy?" value={note} onChangeText={setNote} />
        <Input label="Price" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="0" />
        <Button title="Add" onPress={add} />
      </Card>

      <Card title="This month by category">
        {Object.keys(byCat).length === 0 ? <Text style={{ color: colors.muted }}>No expenses yet.</Text> : null}
        {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Line key={k} label={k} value={fmt(v)} />)}
      </Card>

      <Card title="Recent">
        {month.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text }}>{e.note || e.category}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{e.category} - {e.date.slice(0, 10)}</Text>
            </View>
            <Text style={{ fontWeight: '600', marginHorizontal: 10 }}>{fmt(e.amount)}</Text>
            <Pressable onPress={() => setState((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== e.id) }))}>
              <Text style={{ color: colors.danger, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

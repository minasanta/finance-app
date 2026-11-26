import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useStore, num, fmt, curMonth } from '../../src/store';
import { Screen, Card, Input, Button, Line, colors } from '../../src/ui';

export default function Home() {
  const { state, setState } = useStore();
  const [income, setIncome] = useState('');
  const [allowance, setAllowance] = useState('');

  useEffect(() => {
    setIncome(state.income ? String(state.income) : '');
    setAllowance(state.allowance ? String(state.allowance) : '');
  }, [state.income, state.allowance]);

  const spent = state.expenses.filter((e) => e.date.slice(0, 7) === curMonth())
    .reduce((a, e) => a + e.amount, 0);
  const instMonthly = state.installments.filter((i) => i.paid < i.total).reduce((a, i) => a + i.amount, 0);
  const allowanceLeft = state.allowance - spent;
  const toSave = state.income - state.allowance - instMonthly;
  const totalSavings = state.clouds.reduce((a, c) => a + c.balance, 0);
  const debtLeft = state.installments.reduce((a, i) => a + Math.max(i.total - i.paid, 0) * i.amount, 0);

  return (
    <Screen>
      <Card title="Monthly setup">
        <Input label="Monthly income (salary)" keyboardType="numeric" value={income} onChangeText={setIncome} placeholder="0" />
        <Input label="My personal spending allowance" keyboardType="numeric" value={allowance} onChangeText={setAllowance} placeholder="0" />
        <Button title="Save" onPress={() => setState((s) => ({ ...s, income: num(income), allowance: num(allowance) }))} />
      </Card>

      <Card title="This month">
        <Line label="Income" value={fmt(state.income)} />
        <Line label="Personal allowance" value={fmt(state.allowance)} />
        <Line label="Spent so far" value={fmt(spent)} />
        <Line label="Allowance left" value={fmt(allowanceLeft)} bold color={allowanceLeft < 0 ? colors.danger : colors.primary} />
        <Line label="Installments due monthly" value={fmt(instMonthly)} />
        <Line label="Available to save" value={fmt(toSave)} bold color={toSave < 0 ? colors.danger : colors.primary} />
        {toSave < 0 ? <Text style={{ color: colors.danger }}>Your allowance plus installments exceed your income.</Text> : null}
      </Card>

      <Card title="Wealth">
        <Line label="Total savings and investments" value={fmt(totalSavings)} bold />
        <Line label="Remaining installments (total)" value={fmt(debtLeft)} />
        <Line label="Net" value={fmt(totalSavings - debtLeft)} bold />
      </Card>
    </Screen>
  );
}

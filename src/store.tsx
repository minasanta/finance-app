import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CloudKind = 'instant' | 'monthly' | 'gold' | 'stocks';
export type Cloud = { id: string; name: string; kind: CloudKind; balance: number };
export type Expense = { id: string; date: string; category: string; note: string; amount: number };
export type Installment = {
  id: string; name: string; amount: number; total: number; paid: number;
  dayOfMonth: number; lastPaid?: string;
};
export type State = {
  income: number; allowance: number;
  clouds: Cloud[]; expenses: Expense[]; installments: Installment[];
};

const KEY = 'finance-state-v1';
const empty: State = { income: 0, allowance: 0, clouds: [], expenses: [], installments: [] };

type Ctx = { state: State; setState: (fn: (s: State) => State) => void };
const StoreCtx = createContext<Ctx>({ state: empty, setState: () => {} });

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setS] = useState<State>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) setS({ ...empty, ...JSON.parse(v) }); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  return <StoreCtx.Provider value={{ state, setState: setS }}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const num = (t: string) => { const n = parseFloat((t || '').replace(/,/g, '.')); return isNaN(n) ? 0 : n; };
export const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' EGP';
export const curMonth = () => new Date().toISOString().slice(0, 7);

import { fetch as streamFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { State } from './store';
import { summarize, cloudNow, cloudMonthly } from './calc';

export type Provider = 'claude' | 'gemini';
export type AiSettings = { provider: Provider; model: string; key: string };
export type Msg = { role: 'user' | 'assistant'; content: string; error?: boolean };

const DEFAULT_MODEL: Record<Provider, string> = { claude: 'claude-sonnet-5-5', gemini: 'gemini-2.5-flash' };
export const defaultModel = (p: Provider) => DEFAULT_MODEL[p];

export async function loadSettings(provider?: Provider): Promise<AiSettings> {
  const raw = await AsyncStorage.getItem('ai-settings').catch(() => null);
  const s = raw ? JSON.parse(raw) : {};
  const p: Provider = provider || (s.provider === 'gemini' ? 'gemini' : 'claude');
  const key = (await SecureStore.getItemAsync('ai_key_' + p).catch(() => null)) || '';
  return { provider: p, model: (s.models && s.models[p]) || DEFAULT_MODEL[p], key };
}

export async function saveSettings(a: AiSettings) {
  const raw = await AsyncStorage.getItem('ai-settings').catch(() => null);
  const s = raw ? JSON.parse(raw) : {};
  s.provider = a.provider;
  s.models = { ...(s.models || {}), [a.provider]: a.model };
  await AsyncStorage.setItem('ai-settings', JSON.stringify(s));
  await SecureStore.setItemAsync('ai_key_' + a.provider, a.key);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildSnapshot(st: State) {
  const month = new Date().toISOString().slice(0, 7);
  const byCat: Record<string, number> = {};
  st.expenses.filter((e) => e.date.slice(0, 7) === month)
    .forEach((e) => { byCat[e.category] = r2((byCat[e.category] || 0) + e.amount); });
  const spent = Object.values(byCat).reduce((a, b) => a + b, 0);

  const installments = st.installments.map((i) => ({
    name: i.name, monthlyAmount: i.amount, paid: i.paid, total: i.total, dueDayOfMonth: i.dayOfMonth,
  }));
  const clouds = st.clouds.map((c) => ({
    name: c.name, type: c.kind, estimatedBalance: r2(cloudNow(c)),
    annualYieldPct: c.rate || 0, expectedEarnings30d: r2(cloudMonthly(c)),
  }));
  const holdings = st.holdings.map((h) => {
    const s = summarize(h);
    return {
      name: h.name, type: h.kind, quantity: r2(s.qty), averageCost: r2(s.avgCost),
      currentPrice: h.currentPrice,
      priceLastUpdated: h.priceUpdated ? h.priceUpdated.slice(0, 10) : 'never (still the purchase price)',
      currentValue: r2(s.value), unrealizedProfitLoss: r2(s.unrealized),
      unrealizedProfitLossPct: r2(s.unrealizedPct), realizedProfitLoss: r2(s.realized),
      dividends: r2(s.dividends), whyBought: h.reason || undefined,
      targetPrice: h.target || undefined, stopLoss: h.stop || undefined,
      status: s.qty <= 1e-9 ? 'fully sold' : 'open',
    };
  });
  const sums = st.holdings.map((h) => summarize(h));
  const savings = st.clouds.reduce((a, c) => a + cloudNow(c), 0);
  const invested = sums.reduce((a, s) => a + s.value, 0);
  const remainingInstallments = st.installments.reduce((a, i) => a + Math.max(i.total - i.paid, 0) * i.amount, 0);
  const monthlyInstallments = st.installments.filter((i) => i.paid < i.total).reduce((a, i) => a + i.amount, 0);

  return JSON.stringify({
    today: new Date().toISOString().slice(0, 10),
    currency: 'EGP',
    monthlyIncome: st.income,
    personalAllowance: st.allowance,
    spentThisMonth: r2(spent),
    allowanceLeftThisMonth: r2(st.allowance - spent),
    spentThisMonthByCategory: byCat,
    monthlyInstallmentsTotal: r2(monthlyInstallments),
    installments,
    savingsClouds: clouds,
    investments: holdings,
    totals: {
      savingsClouds: r2(savings), investmentsValue: r2(invested),
      remainingInstallments: r2(remainingInstallments),
      netWorth: r2(savings + invested - remainingInstallments),
    },
  }, null, 1);
}

export function systemPrompt(st: State) {
  return [
    "You are the user's personal finance assistant inside their own budgeting app.",
    'The user lives in Egypt and all amounts are in EGP. They invest through Thndr (EGX stocks, gold, silver) and keep savings in Thndr Clouds (savings funds that earn a daily yield).',
    "Below is the user's full financial snapshot as JSON. Use it in every answer.",
    'Rules:',
    '- Be specific and use their real numbers. Keep answers concise and organized, and explain the reasoning briefly.',
    '- You have NO live market data or news. Stock, gold and silver prices were typed in by the user and may be stale (see priceLastUpdated). Say so when it matters.',
    '- For buy or sell ideas, give the pros, cons and risks. Never promise returns. The final decision is always the user\'s.',
    '- Before suggesting a purchase or investment, consider their emergency savings, monthly installments and remaining personal allowance.',
    '- If important information is missing, say what is missing instead of guessing.',
    '- Reply in the language the user writes in (Egyptian Arabic mixed with English terms is fine).',
    '',
    'SNAPSHOT:',
    buildSnapshot(st),
  ].join('\n');
}

// ---- streaming chat ----------------------------------------------------

function sseLines(text: string, onData: (j: any) => void) {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let j: any;
    try { j = JSON.parse(payload); } catch { continue; }
    onData(j);
  }
}

async function readSSE(res: any, onData: (j: any) => void) {
  if (!res.body || !res.body.getReader) {           // fallback: no streaming support, read everything at once
    sseLines(await res.text(), onData);
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const cut = buf.lastIndexOf('\n');
    if (cut >= 0) {
      sseLines(buf.slice(0, cut), onData);
      buf = buf.slice(cut + 1);
    }
  }
  if (buf.trim()) sseLines(buf, onData);
}

// Streams the reply: onDelta is called with each new piece of text as it arrives.
export async function streamModel(
  cfg: AiSettings, system: string, history: Msg[],
  onDelta: (text: string) => void, signal?: AbortSignal,
): Promise<void> {
  if (!cfg.key) throw new Error('Add your API key in Settings first.');
  let msgs = history.filter((m) => !m.error && m.content).slice(-20);
  while (msgs.length && msgs[0].role !== 'user') msgs = msgs.slice(1);
  const plain = msgs.map((m) => ({ role: m.role, content: m.content }));

  if (cfg.provider === 'claude') {
    const res = await streamFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 2000, system, messages: plain, stream: true }),
    } as any);
    if (!res.ok) {
      const data: any = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message || `Request failed (${res.status})`);
    }
    await readSSE(res, (j) => {
      if (j.type === 'error') throw new Error(j.error?.message || 'The model returned an error.');
      if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' && j.delta.text) onDelta(j.delta.text);
    });
    return;
  }

  const res = await streamFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: plain.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      }),
    } as any,
  );
  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  await readSSE(res, (j) => {
    if (j.error) throw new Error(j.error.message || 'The model returned an error.');
    const parts = j.candidates?.[0]?.content?.parts || [];
    const txt = parts.map((p: any) => p.text || '').join('');
    if (txt) onDelta(txt);
  });
}

// ---- web search (latest prices / yields) -------------------------------

async function searchWeb(cfg: AiSettings, prompt: string): Promise<string> {
  if (!cfg.key) throw new Error('Add your API key in the AI tab, Settings first.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 150000);
  const sys = 'You are a careful research assistant. Use web search to find current data. Never guess numbers. Reply with only the JSON that was requested.';
  try {
    if (cfg.provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: cfg.model, max_tokens: 2500, system: sys,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
      return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
      {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          tools: [{ google_search: {} }],
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
    return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('The search took too long. Try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): any {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('The model did not return usable data. Try again.');
  try { return JSON.parse(text.slice(a, b + 1)); } catch { throw new Error('The model did not return usable data. Try again.'); }
}

export type PriceResult = { name: string; price: number | null; asOf?: string; source?: string };
export type YieldResult = { name: string; rate: number | null; source?: string };

export async function searchPrices(cfg: AiSettings, items: { name: string; kind: string }[]): Promise<PriceResult[]> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt =
    `Today is ${today}. Use web search to find the latest available price in Egyptian pounds (EGP) for each item:\n` +
    `- kind "stock": last traded or closing price per share on the Egyptian Exchange (EGX) for the ticker or company name.\n` +
    `- kind "gold": price per gram in Egypt for the karat in the name (21K if no karat is given).\n` +
    `- kind "silver": price per gram in Egypt.\n` +
    `Items: ${JSON.stringify(items)}\n` +
    `Reply with ONLY this JSON: {"prices":[{"name":"<name exactly as given>","price":<number or null>,"asOf":"<date of the price>","source":"<website>"}]}\n` +
    `Use null when you cannot find a reliable value. Do not guess.`;
  const j = extractJson(await searchWeb(cfg, prompt));
  return (j.prices || []).map((p: any) => ({
    name: String(p.name || ''), price: typeof p.price === 'number' && p.price > 0 ? p.price : null,
    asOf: p.asOf ? String(p.asOf) : undefined, source: p.source ? String(p.source) : undefined,
  }));
}

export async function searchYields(cfg: AiSettings, items: { name: string; kind: string }[]): Promise<YieldResult[]> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt =
    `Today is ${today}. Use web search to find the current annual yield (percent per year) of Thndr savings "Clouds" in Egypt.\n` +
    `kind "instant" = a Cloud with instant withdrawal, kind "monthly" = a Cloud with monthly withdrawal.\n` +
    `Items: ${JSON.stringify(items)}\n` +
    `Reply with ONLY this JSON: {"yields":[{"name":"<name exactly as given>","annualYieldPct":<number or null>,"source":"<website>"}]}\n` +
    `Use null when you cannot find a reliable value. Do not guess.`;
  const j = extractJson(await searchWeb(cfg, prompt));
  return (j.yields || []).map((y: any) => ({
    name: String(y.name || ''), rate: typeof y.annualYieldPct === 'number' && y.annualYieldPct > 0 ? y.annualYieldPct : null,
    source: y.source ? String(y.source) : undefined,
  }));
}

export type ModelInfo = { id: string; label: string };

// Ask the provider which models this API key can use.
export async function fetchModels(provider: Provider, key: string): Promise<ModelInfo[]> {
  const out: ModelInfo[] = [];
  if (provider === 'claude') {
    let after = '';
    for (let i = 0; i < 5; i++) {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=100' + (after ? `&after_id=${after}` : ''), {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
      (data.data || []).forEach((m: any) => out.push({ id: m.id, label: m.display_name || m.id }));
      if (!data.has_more || !data.last_id) break;
      after = data.last_id;
    }
    return out;
  }
  let token = '';
  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100' + (token ? `&pageToken=${encodeURIComponent(token)}` : ''), {
      headers: { 'x-goog-api-key': key },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
    (data.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .forEach((m: any) => {
        const id = String(m.name).replace(/^models\//, '');
        out.push({ id, label: m.displayName || id });
      });
    token = data.nextPageToken || '';
    if (!token) break;
  }
  return out;
}

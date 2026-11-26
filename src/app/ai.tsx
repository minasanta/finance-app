import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import { useStore, uid } from '../store';
import { AiSettings, Msg, Provider, defaultModel, loadSettings, saveSettings, streamModel, systemPrompt } from '../ai';
import ModelPicker from '../ModelPicker';
import { Card, Input, Button, Chips, colors } from '../ui';

type Chat = { id: string; title: string; updated: string; msgs: Msg[] };
const CHATS_KEY = 'ai-chats-v1';
const newChat = (): Chat => ({ id: uid(), title: 'New chat', updated: new Date().toISOString(), msgs: [] });

const QUICK = [
  { label: 'Full analysis', text: 'اعمل تحليل كامل لوضعي المالي: الميزانية والمصاريف والتحويش والاستثمارات، وقولي أهم 5 حاجات أعملها.' },
  { label: 'Spending', text: 'أنا بصرف زيادة فين الشهر ده؟ وإزاي أقلل المصاريف؟' },
  { label: 'Portfolio', text: 'راجع محفظتي (الأسهم والذهب والفضة): إيه الرابح وإيه الخاسر، وهل التوزيع متوازن، وإيه المخاطر؟' },
  { label: 'Big purchase', text: 'عايز أشتري ... بحوالي ... جنيه. الأحسن أشتري الشهر ده ولا الشهر الجاي؟ وأعمل إيه عشان أقدر؟' },
];
// how the assistant's formatted replies (bold, headings, lists, tables, code) look
const mdStyle: any = {
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  heading1: { fontSize: 20, fontWeight: '700', marginTop: 6, marginBottom: 6 },
  heading2: { fontSize: 18, fontWeight: '700', marginTop: 6, marginBottom: 6 },
  heading3: { fontSize: 16, fontWeight: '700', marginTop: 4, marginBottom: 4 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  bullet_list: { marginBottom: 6 },
  ordered_list: { marginBottom: 6 },
  list_item: { marginBottom: 2 },
  code_inline: { backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 4 },
  code_block: { backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 },
  fence: { backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 },
  blockquote: { backgroundColor: '#F3F4F6', borderLeftWidth: 3, borderColor: colors.primary, paddingHorizontal: 8, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, marginBottom: 8 },
  th: { padding: 6, fontWeight: '700' },
  td: { padding: 6 },
  tr: { borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row' },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
};

const PROVIDERS = [{ value: 'claude', label: 'Claude' }, { value: 'gemini', label: 'Gemini' }];

export default function AI() {
  const { state } = useStore();
  const [tab, setTab] = useState('chat');
  const [cfg, setCfg] = useState<AiSettings>({ provider: 'claude', model: defaultModel('claude'), key: '' });
  const [saved, setSaved] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { loadSettings().then(setCfg).catch(() => {}); }, []);

  // load saved chats
  useEffect(() => {
    AsyncStorage.getItem(CHATS_KEY).then((v) => {
      const d = v ? JSON.parse(v) : null;
      if (d && Array.isArray(d.chats) && d.chats.length) {
        setChats(d.chats);
        setActiveId(d.activeId && d.chats.some((c: Chat) => c.id === d.activeId) ? d.activeId : d.chats[0].id);
      } else {
        const c = newChat(); setChats([c]); setActiveId(c.id);
      }
    }).catch(() => { const c = newChat(); setChats([c]); setActiveId(c.id); })
      .finally(() => setLoaded(true));
  }, []);

  // save chats (not on every streamed word)
  useEffect(() => {
    if (loaded && !busy) AsyncStorage.setItem(CHATS_KEY, JSON.stringify({ chats, activeId })).catch(() => {});
  }, [chats, activeId, loaded, busy]);

  const active = chats.find((c) => c.id === activeId) || chats[0];
  const patch = (id: string, fn: (c: Chat) => Chat) => setChats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const switchProvider = async (p: string) => { setSaved(false); setCfg(await loadSettings(p as Provider)); };
  const saveKey = async () => { await saveSettings({ ...cfg, key: cfg.key.trim() }); setSaved(true); };

  const startNewChat = () => {
    if (busy) return;
    const c = newChat();
    setChats((prev) => [c, ...prev]); setActiveId(c.id); setTab('chat');
  };
  const removeChat = (c: Chat) =>
    Alert.alert('Delete chat', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const rest = chats.filter((x) => x.id !== c.id);
        if (rest.length === 0) { const n = newChat(); setChats([n]); setActiveId(n.id); }
        else { setChats(rest); if (activeId === c.id) setActiveId(rest[0].id); }
      } },
    ]);

  const send = async (content: string) => {
    const t = content.trim();
    if (!t || busy || !active) return;
    const id = active.id;
    const history: Msg[] = [...active.msgs, { role: 'user', content: t }];
    patch(id, (c) => ({
      ...c, title: c.msgs.length === 0 ? t.slice(0, 40) : c.title, updated: new Date().toISOString(),
      msgs: [...history, { role: 'assistant', content: '' }],
    }));
    setText(''); setBusy(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    const timer = setTimeout(() => ctl.abort(), 180000);
    let acc = '';
    try {
      await streamModel(cfg, systemPrompt(state), history, (d) => {
        acc += d;
        patch(id, (c) => ({ ...c, msgs: [...c.msgs.slice(0, -1), { role: 'assistant', content: acc }] }));
      }, ctl.signal);
      if (!acc) throw new Error('The model returned an empty reply.');
    } catch (e: any) {
      const stopped = e?.name === 'AbortError' || /abort/i.test(String(e?.message));
      const msg = stopped ? 'Stopped' : (e?.message || String(e));
      patch(id, (c) => {
        const msgs = c.msgs.slice();
        msgs[msgs.length - 1] = acc
          ? { role: 'assistant', content: acc + `\n\n[${msg}]` }
          : { role: 'assistant', content: stopped ? 'Stopped.' : 'Error: ' + msg, error: true };
        return { ...c, msgs };
      });
    }
    clearTimeout(timer);
    abortRef.current = null;
    setBusy(false);
  };

  const msgs = active?.msgs || [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ padding: 12 }}>
        <Chips options={[{ value: 'chat', label: 'Chat' }, { value: 'chats', label: 'Chats' }, { value: 'settings', label: 'Settings' }]} value={tab} onChange={setTab} />
      </View>

      {tab === 'settings' ? (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Card title="AI provider and key">
            <Chips options={PROVIDERS} value={cfg.provider} onChange={switchProvider} />
            <Input label="API key" value={cfg.key} onChangeText={(k) => { setSaved(false); setCfg({ ...cfg, key: k }); }}
              secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Paste your key" />
            <Button title={saved ? 'Key saved' : 'Save key'} onPress={saveKey} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Claude keys come from console.anthropic.com and Gemini keys from Google AI Studio. API usage is billed by the provider, separately from any chat subscription.
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              The key is kept in secure storage on this phone. When you ask a question, a summary of your finances is sent to the provider you picked so it can answer.
            </Text>
          </Card>
          <Card title="Model">
            <ModelPicker cfg={cfg} setCfg={setCfg} />
          </Card>
        </ScrollView>
      ) : tab === 'chats' ? (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          <Button title="New chat" onPress={startNewChat} />
          {chats.slice().sort((a, b) => b.updated.localeCompare(a.updated)).map((c) => (
            <Pressable key={c.id} onPress={() => { if (!busy) { setActiveId(c.id); setTab('chat'); } }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: c.id === activeId ? '700' : '500', color: colors.text }} numberOfLines={1}>{c.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{c.updated.slice(0, 10)} - {c.msgs.length} messages</Text>
                  </View>
                  <Pressable onPress={() => removeChat(c)}><Text style={{ color: colors.danger, fontSize: 22 }}>×</Text></Pressable>
                </View>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <>
          <Pressable onPress={() => setShowPicker((v) => !v)}
            style={{ marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text }}>
              {cfg.provider === 'claude' ? 'Claude' : 'Gemini'} - {cfg.model}  {showPicker ? '▴' : '▾'}
            </Text>
          </Pressable>
          {showPicker ? (
            <View style={{ marginHorizontal: 12, marginBottom: 8 }}>
              <Card title="Choose the model for this chat">
                <Chips options={PROVIDERS} value={cfg.provider} onChange={switchProvider} />
                <ModelPicker cfg={cfg} setCfg={setCfg} />
                <Button title="Done" onPress={() => setShowPicker(false)} />
              </Card>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
            {QUICK.map((q) => (
              <Pressable key={q.label} onPress={() => (q.label === 'Big purchase' ? setText(q.text) : send(q.text))}
                style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }}>
                <Text>{q.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
            {msgs.length === 0 ? (
              <Text style={{ color: colors.muted }}>
                Ask anything about your money, or tap a quick option above. The assistant sees your income, spending, savings, installments and investments. Each chat keeps its own history (see the Chats tab).
                {!cfg.key ? '\n\nFirst add your API key in Settings.' : ''}
              </Text>
            ) : null}
            {msgs.map((m, i) => (
              <View key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: 10, borderRadius: 12,
                backgroundColor: m.error ? '#FEE2E2' : m.role === 'user' ? colors.primary : '#fff',
                borderWidth: m.role === 'user' ? 0 : 1, borderColor: colors.border,
              }}>
                {m.role === 'assistant' && !m.content && busy && i === msgs.length - 1
                  ? <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Thinking...</Text>
                  : m.role === 'user' || m.error
                    ? <Text selectable style={{ color: m.role === 'user' ? '#fff' : colors.text }}>{m.content}</Text>
                    : <Markdown style={mdStyle}>{m.content}</Markdown>}
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }}>
            <TextInput value={text} onChangeText={setText} placeholder="Ask about your finances" multiline
              style={{ flex: 1, maxHeight: 110, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }} />
            {busy
              ? <Button title="Stop" color={colors.danger} onPress={() => abortRef.current?.abort()} />
              : <Button title="Send" onPress={() => send(text)} />}
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

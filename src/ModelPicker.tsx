import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiSettings, ModelInfo, fetchModels, saveSettings } from './ai';
import { Button, colors } from './ui';

export default function ModelPicker({ cfg, setCfg }: { cfg: AiSettings; setCfg: (c: AiSettings) => void }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cacheKey = 'ai-models-' + cfg.provider;

  const load = async () => {
    if (!cfg.key.trim()) { setErr('Add your API key first.'); return; }
    setBusy(true); setErr('');
    try {
      const list = await fetchModels(cfg.provider, cfg.key.trim());
      setModels(list);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(list));
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
    setBusy(false);
  };

  // show the saved list first; fetch it automatically if there is a key but no list yet
  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await AsyncStorage.getItem(cacheKey).catch(() => null);
      const cached: ModelInfo[] = v ? JSON.parse(v) : [];
      if (!alive) return;
      setModels(cached); setErr('');
      if (!cached.length && cfg.key.trim()) load();
    })();
    return () => { alive = false; };
  }, [cfg.provider, !!cfg.key]);

  const pick = async (id: string) => {
    const next = { ...cfg, model: id };
    setCfg(next);
    await saveSettings(next).catch(() => {});
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>Model in use</Text>
      <Text style={{ fontWeight: '700', color: colors.text }}>{cfg.model}</Text>
      <Button title={busy ? 'Loading...' : models.length ? 'Refresh model list' : 'Load available models'} color="#374151" onPress={load} />
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      {err ? <Text style={{ color: colors.danger }}>{err}</Text> : null}
      {models.length > 0 ? (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}>
          {models.map((m) => {
            const sel = m.id === cfg.model;
            return (
              <Pressable key={m.id} onPress={() => pick(m.id)}
                style={{ padding: 10, backgroundColor: sel ? colors.primary : '#fff', borderBottomWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: sel ? '#fff' : colors.text, fontWeight: '600' }}>{m.label}</Text>
                <Text style={{ color: sel ? '#E5E7EB' : colors.muted, fontSize: 12 }}>{m.id}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

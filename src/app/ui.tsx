import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps, ScrollView } from 'react-native';

export const colors = {
  bg: '#F4F6F8', card: '#FFFFFF', primary: '#0F766E', text: '#111827',
  muted: '#6B7280', danger: '#DC2626', border: '#E5E7EB',
};

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Input({ label, ...p }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#9CA3AF" {...p} style={[s.input, p.style]} />
    </View>
  );
}

export function Button({ title, onPress, color = colors.primary, flex }: {
  title: string; onPress: () => void; color?: string; flex?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[s.btn, { backgroundColor: color }, flex && { flex: 1 }]}>
      <Text style={s.btnText}>{title}</Text>
    </Pressable>
  );
}

export function Chips({ options, value, onChange }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)}
          style={[s.chip, value === o.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <Text style={{ color: value === o.value ? '#fff' : colors.text }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Line({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <Text style={{ color: color || colors.text, fontWeight: bold ? '700' : '500' }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { fontSize: 12, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: colors.text, backgroundColor: '#fff' },
  btn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
});

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StoreProvider } from '../../src/store';

const icon = (name: any) => ({ color, size }: { color: string; size: number }) =>
  <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <StoreProvider>
      <Tabs screenOptions={{ headerTitleAlign: 'center', tabBarActiveTintColor: '#0F766E' }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
        <Tabs.Screen name="clouds" options={{ title: 'Savings', tabBarIcon: icon('cloud') }} />
        <Tabs.Screen name="expenses" options={{ title: 'Expenses', tabBarIcon: icon('receipt') }} />
        <Tabs.Screen name="installments" options={{ title: 'Installments', tabBarIcon: icon('calendar') }} />
      </Tabs>
    </StoreProvider>
  );
}

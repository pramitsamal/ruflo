import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import WalletConnectButton from '../src/components/WalletConnectButton';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#030712' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'SMMN',
            headerRight: () => <WalletConnectButton compact />,
          }}
        />
        <Stack.Screen
          name="events/index"
          options={{ title: 'Events' }}
        />
        <Stack.Screen
          name="events/[id]"
          options={{ title: '', headerTransparent: true }}
        />
        <Stack.Screen
          name="dashboard"
          options={{ title: 'My Dashboard' }}
        />
        <Stack.Screen
          name="stake"
          options={{ title: '$SUMMON Staking' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}

import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { useWallet } from '../hooks/useWallet';

interface WalletConnectButtonProps {
  compact?: boolean;
}

export default function WalletConnectButton({ compact = false }: WalletConnectButtonProps) {
  const { truncated, connecting, connect, disconnect } = useWallet();
  const isConnected = truncated !== null;

  const handlePress = () => {
    if (isConnected) {
      disconnect();
    } else {
      void connect();
    }
  };

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        className="bg-purple-600 rounded-lg px-3 py-1.5 active:opacity-75"
      >
        {connecting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text className="text-white text-sm font-semibold">
            {isConnected ? truncated : 'Connect'}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      className="bg-purple-600 rounded-xl px-4 py-3 flex-row items-center justify-center active:opacity-75"
    >
      {connecting ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <View className="flex-row items-center gap-2">
          <View
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}
          />
          <Text className="text-white font-semibold">
            {isConnected ? truncated! : 'Connect Wallet'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

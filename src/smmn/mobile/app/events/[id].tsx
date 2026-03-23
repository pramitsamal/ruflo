import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import BackerRoundProgress from '../../src/components/BackerRoundProgress';
import { useEvent } from '../../src/hooks/useEvents';
import { useWallet } from '../../src/hooks/useWallet';
import { purchaseBackerSlot } from '../../src/api/smmn-client';

const VVIP_BENEFITS = [
  'Guaranteed artist payout before show day',
  'VVIP NFT access pass (transferable)',
  'Exclusive backstage access',
  'Name in show credits',
  'Early ticket priority access',
  'Governance voting rights',
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { data: event, isLoading, error } = useEvent(id ?? '');
  const { walletAddress, connect, connecting } = useWallet();
  const [purchasing, setPurchasing] = useState(false);

  React.useEffect(() => {
    if (event) {
      navigation.setOptions({ title: event.artist });
    }
  }, [event, navigation]);

  const handlePurchase = async () => {
    if (!walletAddress) {
      await connect();
      return;
    }
    if (!event) return;
    setPurchasing(true);
    try {
      await purchaseBackerSlot(event.id, walletAddress);
      Alert.alert('Success', 'VVIP slot purchased! Your NFT will arrive shortly.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center px-6">
        <Text className="text-red-400 text-center">Failed to load event.</Text>
      </View>
    );
  }

  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const canPurchase = event.status === 'open' && event.slotsFilled < event.slotsTotal;
  const projectedRevenue = event.projectedRevenue ?? Math.round(event.guarantee * 1.4);
  const budget = event.budget ?? Math.round(event.guarantee * 0.75);

  return (
    <ScrollView className="flex-1 bg-gray-950">
      {/* Hero */}
      <LinearGradient
        colors={['#581c87', '#1f1035', '#030712']}
        className="px-4 pt-14 pb-8"
      >
        <Text className="text-white text-2xl font-bold mb-1">{event.artist}</Text>
        <Text className="text-purple-400 text-base mb-1">{event.city}, {event.country}</Text>
        {event.venue && (
          <Text className="text-gray-400 text-sm mb-1">{event.venue}</Text>
        )}
        <Text className="text-gray-400 text-sm">{formattedDate}</Text>
        <View className="flex-row flex-wrap gap-2 mt-3">
          {event.genre.map((g) => (
            <View key={g} className="bg-gray-800 rounded px-2 py-0.5">
              <Text className="text-purple-400 text-xs">{g}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View className="px-4 pb-10 gap-4 mt-4">
        {/* Backer round progress */}
        <BackerRoundProgress
          slotsFilled={event.slotsFilled}
          slotsTotal={event.slotsTotal}
          slotPrice={event.slotPrice}
        />

        {/* VVIP Benefits */}
        <View className="bg-gray-900 rounded-xl p-4">
          <Text className="text-white text-base font-bold mb-3">VVIP Benefits</Text>
          {VVIP_BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-start gap-2 mb-2">
              <Text className="text-green-400 mt-0.5">✓</Text>
              <Text className="text-gray-300 text-sm flex-1">{benefit}</Text>
            </View>
          ))}
        </View>

        {/* P&L Preview */}
        <View className="bg-gray-900 rounded-xl p-4">
          <Text className="text-white text-base font-bold mb-3">Financial Overview</Text>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-sm">Artist Guarantee</Text>
              <Text className="text-white font-semibold">
                ${event.guarantee.toLocaleString()}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-sm">Show Budget</Text>
              <Text className="text-white font-semibold">${budget.toLocaleString()}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-sm">Projected Revenue</Text>
              <Text className="text-green-400 font-semibold">
                ${projectedRevenue.toLocaleString()}
              </Text>
            </View>
            <View className="h-px bg-gray-800 my-1" />
            <View className="flex-row justify-between">
              <Text className="text-gray-400 text-sm">Projected Profit</Text>
              <Text className="text-green-400 font-bold text-base">
                +${(projectedRevenue - budget).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Ticket tier info */}
        <View className="bg-gray-900 rounded-xl p-4">
          <Text className="text-white text-base font-bold mb-3">Slot Info</Text>
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-gray-400 text-xs mb-0.5">Price per VVIP Slot</Text>
              <Text className="text-white text-xl font-bold">
                ${event.slotPrice.toLocaleString()}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-400 text-xs mb-0.5">Available</Text>
              <Text className="text-amber-400 text-xl font-bold">
                {event.slotsTotal - event.slotsFilled}
              </Text>
            </View>
          </View>
        </View>

        {/* Purchase button */}
        <Pressable
          onPress={() => { void handlePurchase(); }}
          disabled={!canPurchase || purchasing || connecting}
          className={`rounded-xl py-4 items-center ${
            canPurchase && !purchasing && !connecting
              ? 'bg-purple-600 active:opacity-75'
              : 'bg-gray-700'
          }`}
        >
          {purchasing || connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">
              {!canPurchase
                ? event.status === 'open'
                  ? 'Sold Out'
                  : 'Round Closed'
                : walletAddress
                ? `Purchase VVIP Slot — $${event.slotPrice.toLocaleString()}`
                : 'Connect Wallet to Purchase'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

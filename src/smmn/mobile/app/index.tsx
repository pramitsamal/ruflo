import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import EventCard from '../src/components/EventCard';
import { useEvents } from '../src/hooks/useEvents';
import type { SMMNEvent } from '../src/api/smmn-client';

const STAT_CHIPS = [
  { label: 'Events Backed', value: '48' },
  { label: 'Guarantees', value: '$2.4M' },
  { label: 'Backers', value: '1,280' },
  { label: 'NFTs Minted', value: '3,840' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { data: events, isLoading, isRefetching, refetch, error } = useEvents('open');

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#a855f7"
        />
      }
    >
      {/* Hero gradient header */}
      <LinearGradient
        colors={['#581c87', '#1f1035', '#030712']}
        className="px-4 pt-6 pb-8"
      >
        <Text className="text-white text-3xl font-bold mb-1">SMMN</Text>
        <Text className="text-purple-400 text-base mb-6">
          Back artists. Get paid before the show.
        </Text>

        {/* Stat chips */}
        <View className="flex-row flex-wrap gap-2">
          {STAT_CHIPS.map((chip) => (
            <View
              key={chip.label}
              className="bg-gray-900 rounded-xl px-3 py-2 flex-1 min-w-[40%] items-center"
            >
              <Text className="text-white text-lg font-bold">{chip.value}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">{chip.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Section header */}
      <View className="flex-row items-center justify-between px-4 mb-3 mt-2">
        <Text className="text-white text-lg font-bold">Live Backer Rounds</Text>
        <Pressable onPress={() => router.push('/events')}>
          <Text className="text-purple-400 text-sm">View all</Text>
        </Pressable>
      </View>

      {isLoading && (
        <View className="py-10 items-center">
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      )}

      {error !== null && !isLoading && (
        <View className="mx-4 bg-gray-900 rounded-xl p-4">
          <Text className="text-red-400 text-sm text-center">
            Failed to load events. Pull down to retry.
          </Text>
        </View>
      )}

      {!isLoading && events && events.length === 0 && (
        <View className="mx-4 bg-gray-900 rounded-xl p-6 items-center">
          <Text className="text-gray-400 text-center">No open backer rounds right now.</Text>
        </View>
      )}

      {!isLoading && events && events.length > 0 && (
        <FlashList
          data={events}
          estimatedItemSize={220}
          scrollEnabled={false}
          keyExtractor={(item: SMMNEvent) => item.id}
          renderItem={({ item }: { item: SMMNEvent }) => (
            <EventCard
              event={item}
              onPress={() => router.push(`/events/${item.id}`)}
            />
          )}
        />
      )}

      {/* Bottom nav shortcuts */}
      <View className="flex-row gap-3 mx-4 mt-4 mb-8">
        <Pressable
          onPress={() => router.push('/events')}
          className="flex-1 bg-gray-900 rounded-xl py-4 items-center active:opacity-75"
        >
          <Text className="text-white font-semibold">Events</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/dashboard')}
          className="flex-1 bg-gray-900 rounded-xl py-4 items-center active:opacity-75"
        >
          <Text className="text-white font-semibold">Dashboard</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/stake')}
          className="flex-1 bg-purple-600 rounded-xl py-4 items-center active:opacity-75"
        >
          <Text className="text-white font-semibold">Stake</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

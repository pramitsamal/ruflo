import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import EventCard from '../../src/components/EventCard';
import { useEvents } from '../../src/hooks/useEvents';
import type { SMMNEvent } from '../../src/api/smmn-client';

type FilterTab = 'all' | 'open' | 'filled' | 'completed';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'filled', label: 'Filled' },
  { key: 'completed', label: 'Completed' },
];

export default function EventsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const { data: events, isLoading, isRefetching, refetch, error } = useEvents(statusFilter);

  return (
    <View className="flex-1 bg-gray-950">
      {/* Filter tabs */}
      <View className="flex-row px-4 py-3 gap-2 border-b border-gray-800">
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-full ${
              activeTab === tab.key ? 'bg-purple-600' : 'bg-gray-800'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                activeTab === tab.key ? 'text-white' : 'text-gray-400'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      )}

      {error !== null && !isLoading && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-400 text-center">
            Failed to load events. Pull down to retry.
          </Text>
        </View>
      )}

      {!isLoading && events && (
        <FlashList
          data={events}
          estimatedItemSize={220}
          keyExtractor={(item: SMMNEvent) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#a855f7"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6">
              <Text className="text-gray-400 text-center">
                No {activeTab === 'all' ? '' : activeTab} events found.
              </Text>
            </View>
          }
          renderItem={({ item }: { item: SMMNEvent }) => (
            <EventCard
              event={item}
              onPress={() => router.push(`/events/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { SMMNEvent } from '../api/smmn-client';

const STATUS_LABELS: Record<SMMNEvent['status'], string> = {
  open: 'OPEN',
  filled: 'FILLED',
  in_production: 'IN PRODUCTION',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const STATUS_COLORS: Record<SMMNEvent['status'], string> = {
  open: 'bg-purple-600',
  filled: 'bg-amber-600',
  in_production: 'bg-blue-600',
  completed: 'bg-green-700',
  cancelled: 'bg-gray-700',
};

interface EventCardProps {
  event: SMMNEvent;
  onPress?: () => void;
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const fillPercent = event.slotsTotal > 0
    ? Math.round((event.slotsFilled / event.slotsTotal) * 100)
    : 0;
  const remaining = event.slotsTotal - event.slotsFilled;
  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedPrice = `$${event.slotPrice.toLocaleString()}`;
  const formattedGuarantee = `$${event.guarantee.toLocaleString()}`;

  return (
    <Pressable
      onPress={onPress}
      className="bg-gray-900 rounded-xl mx-4 mb-4 overflow-hidden active:opacity-80"
    >
      <View className="p-4">
        {/* Header row */}
        <View className="flex-row items-start justify-between mb-1">
          <Text className="text-white text-lg font-bold flex-1 mr-2" numberOfLines={1}>
            {event.artist}
          </Text>
          <View className={`px-2 py-0.5 rounded ${STATUS_COLORS[event.status]}`}>
            <Text className="text-white text-xs font-semibold">
              {STATUS_LABELS[event.status]}
            </Text>
          </View>
        </View>

        {/* Location and date */}
        <Text className="text-gray-400 text-sm mb-3">
          {event.city}, {event.country} — {formattedDate}
        </Text>

        {/* Genre tags */}
        <View className="flex-row flex-wrap gap-1 mb-3">
          {event.genre.map((g) => (
            <View key={g} className="bg-gray-800 rounded px-2 py-0.5">
              <Text className="text-purple-400 text-xs">{g}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        <View className="mb-2">
          <View className="flex-row justify-between mb-1">
            <Text className="text-gray-400 text-xs">
              {event.slotsFilled}/{event.slotsTotal} slots filled
            </Text>
            <Text className="text-purple-400 text-xs font-semibold">{fillPercent}%</Text>
          </View>
          <View className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <View
              className="h-2 bg-purple-600 rounded-full"
              style={{ width: `${fillPercent}%` }}
            />
          </View>
          {remaining > 0 && (
            <Text className="text-gray-400 text-xs mt-1">{remaining} slots remaining</Text>
          )}
        </View>

        {/* Price and guarantee */}
        <View className="flex-row items-center justify-between mt-1">
          <View>
            <Text className="text-gray-400 text-xs">Slot price</Text>
            <Text className="text-white text-base font-bold">{formattedPrice}</Text>
          </View>
          <View className="items-end">
            <Text className="text-gray-400 text-xs">Guarantee</Text>
            <Text className="text-green-400 text-base font-bold">{formattedGuarantee}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

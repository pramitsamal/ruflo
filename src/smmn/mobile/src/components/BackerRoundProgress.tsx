import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface BackerRoundProgressProps {
  slotsFilled: number;
  slotsTotal: number;
  slotPrice: number;
}

export default function BackerRoundProgress({
  slotsFilled,
  slotsTotal,
  slotPrice,
}: BackerRoundProgressProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const fillPercent = slotsTotal > 0 ? (slotsFilled / slotsTotal) * 100 : 0;
  const remaining = slotsTotal - slotsFilled;
  const totalRaised = slotsFilled * slotPrice;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: fillPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [fillPercent, animatedWidth]);

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="bg-gray-900 rounded-xl p-4">
      <Text className="text-white text-base font-bold mb-3">Backer Round</Text>

      {/* Slot counts */}
      <View className="flex-row justify-between mb-2">
        <View className="items-center">
          <Text className="text-white text-xl font-bold">{slotsFilled}</Text>
          <Text className="text-gray-400 text-xs">Filled</Text>
        </View>
        <View className="items-center">
          <Text className="text-purple-400 text-xl font-bold">{Math.round(fillPercent)}%</Text>
          <Text className="text-gray-400 text-xs">Complete</Text>
        </View>
        <View className="items-center">
          <Text className="text-white text-xl font-bold">{slotsTotal}</Text>
          <Text className="text-gray-400 text-xs">Total Slots</Text>
        </View>
      </View>

      {/* Animated progress bar */}
      <View className="h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
        <Animated.View
          className="h-3 bg-purple-600 rounded-full"
          style={{ width: widthInterpolated }}
        />
      </View>

      {/* Bottom stats */}
      <View className="flex-row justify-between">
        <View>
          <Text className="text-gray-400 text-xs">Price per slot</Text>
          <Text className="text-white font-semibold">${slotPrice.toLocaleString()}</Text>
        </View>
        <View className="items-center">
          <Text className="text-gray-400 text-xs">Remaining</Text>
          <Text className="text-amber-400 font-semibold">
            {remaining > 0 ? `${remaining} slots` : 'Sold out'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-gray-400 text-xs">Raised</Text>
          <Text className="text-green-400 font-semibold">${totalRaised.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

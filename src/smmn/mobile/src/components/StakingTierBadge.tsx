import React from 'react';
import { View, Text } from 'react-native';
import type { StakingPosition } from '../api/smmn-client';

type Tier = StakingPosition['tier'];

const TIER_CONFIG: Record<
  Tier,
  { label: string; bgClass: string; textClass: string; threshold: string }
> = {
  none: {
    label: 'No Tier',
    bgClass: 'bg-gray-700',
    textClass: 'text-gray-300',
    threshold: '< 1,000 $SUMMON',
  },
  bronze: {
    label: 'Bronze',
    bgClass: 'bg-amber-800',
    textClass: 'text-amber-300',
    threshold: '1,000 $SUMMON',
  },
  silver: {
    label: 'Silver',
    bgClass: 'bg-gray-600',
    textClass: 'text-gray-200',
    threshold: '5,000 $SUMMON',
  },
  gold: {
    label: 'Gold',
    bgClass: 'bg-yellow-700',
    textClass: 'text-yellow-300',
    threshold: '25,000 $SUMMON',
  },
};

interface StakingTierBadgeProps {
  tier: Tier;
  showThreshold?: boolean;
  size?: 'sm' | 'md';
}

export default function StakingTierBadge({
  tier,
  showThreshold = false,
  size = 'md',
}: StakingTierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const paddingClass = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View className="flex-row items-center gap-2">
      <View className={`rounded-full ${paddingClass} ${config.bgClass}`}>
        <Text className={`font-bold ${textSizeClass} ${config.textClass}`}>
          {config.label}
        </Text>
      </View>
      {showThreshold && (
        <Text className="text-gray-400 text-xs">{config.threshold}</Text>
      )}
    </View>
  );
}

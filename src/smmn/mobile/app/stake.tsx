import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import StakingTierBadge from '../src/components/StakingTierBadge';
import { useWallet } from '../src/hooks/useWallet';
import { useStakingPosition, useStake, useUnstake, useClaimYield } from '../src/hooks/useStaking';

type ActionTab = 'stake' | 'unstake' | 'claim';

const PLATFORM_STATS = [
  { label: 'Total Staked', value: '14.2M $SUMMON' },
  { label: 'APY', value: '18.4%' },
  { label: 'Stakers', value: '2,847' },
  { label: 'Next Yield', value: 'Apr 1' },
];

const TIER_LADDER = [
  { tier: 'none' as const, label: 'No Tier', threshold: '< 1,000', perks: 'Basic access' },
  { tier: 'bronze' as const, label: 'Bronze', threshold: '1,000+', perks: 'Priority slots + 5% fee discount' },
  { tier: 'silver' as const, label: 'Silver', threshold: '5,000+', perks: 'Guaranteed slot access + 10% discount' },
  { tier: 'gold' as const, label: 'Gold', threshold: '25,000+', perks: 'VIP benefits + 20% discount + governance weight' },
];

export default function StakeScreen() {
  const { walletAddress, connect, connecting } = useWallet();
  const { data: position, isLoading } = useStakingPosition(walletAddress);
  const stakeMutation = useStake();
  const unstakeMutation = useUnstake();
  const claimMutation = useClaimYield();

  const [activeTab, setActiveTab] = useState<ActionTab>('stake');
  const [amount, setAmount] = useState('');

  const handleAction = async () => {
    if (!walletAddress) {
      await connect();
      return;
    }
    const trimmed = amount.trim();
    if (activeTab !== 'claim' && (!trimmed || isNaN(Number(trimmed)) || Number(trimmed) <= 0)) {
      Alert.alert('Invalid amount', 'Enter a valid $SUMMON amount.');
      return;
    }
    try {
      if (activeTab === 'stake') {
        await stakeMutation.mutateAsync({ wallet: walletAddress, amount: trimmed });
        Alert.alert('Staked', `${trimmed} $SUMMON staked successfully.`);
      } else if (activeTab === 'unstake') {
        await unstakeMutation.mutateAsync({ wallet: walletAddress, amount: trimmed });
        Alert.alert('Unstaked', `${trimmed} $SUMMON unstaked successfully.`);
      } else {
        await claimMutation.mutateAsync({ wallet: walletAddress });
        Alert.alert('Claimed', 'Yield claimed successfully.');
      }
      setAmount('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  const isPending =
    stakeMutation.isPending || unstakeMutation.isPending || claimMutation.isPending;

  return (
    <ScrollView className="flex-1 bg-gray-950">
      <View className="px-4 pt-4 pb-10 gap-4">

        {/* Platform stats */}
        <View className="flex-row flex-wrap gap-2">
          {PLATFORM_STATS.map((stat) => (
            <View
              key={stat.label}
              className="bg-gray-900 rounded-xl px-3 py-3 flex-1 min-w-[40%] items-center"
            >
              <Text className="text-white text-base font-bold">{stat.value}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* My position */}
        {walletAddress && (
          <View className="bg-gray-900 rounded-xl p-4">
            <Text className="text-white text-base font-bold mb-3">My Position</Text>
            {isLoading ? (
              <ActivityIndicator color="#a855f7" />
            ) : position ? (
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Staked</Text>
                  <Text className="text-white font-semibold">
                    {Number(position.stakedAmount).toLocaleString()} $SUMMON
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-sm">Earned yield</Text>
                  <Text className="text-green-400 font-semibold">
                    +{Number(position.earnedYield).toLocaleString()} $SUMMON
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-gray-400 text-sm">Tier</Text>
                  <StakingTierBadge tier={position.tier} size="sm" />
                </View>
              </View>
            ) : (
              <Text className="text-gray-400 text-sm">No active staking position.</Text>
            )}
          </View>
        )}

        {/* Action tabs */}
        <View className="bg-gray-900 rounded-xl overflow-hidden">
          <View className="flex-row border-b border-gray-800">
            {(['stake', 'unstake', 'claim'] as ActionTab[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-3 items-center ${
                  activeTab === tab ? 'border-b-2 border-purple-500' : ''
                }`}
              >
                <Text
                  className={`font-semibold text-sm capitalize ${
                    activeTab === tab ? 'text-purple-400' : 'text-gray-400'
                  }`}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="p-4">
            {activeTab !== 'claim' && (
              <View className="mb-4">
                <Text className="text-gray-400 text-xs mb-1">Amount ($SUMMON)</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor="#4b5563"
                  keyboardType="numeric"
                  className="bg-gray-800 rounded-lg px-3 py-3 text-white text-base"
                />
              </View>
            )}

            {activeTab === 'claim' && position && (
              <View className="mb-4 items-center py-2">
                <Text className="text-gray-400 text-sm mb-1">Available to claim</Text>
                <Text className="text-green-400 text-2xl font-bold">
                  +{Number(position.earnedYield).toLocaleString()} $SUMMON
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => { void handleAction(); }}
              disabled={isPending || connecting}
              className={`rounded-xl py-4 items-center ${
                isPending || connecting ? 'bg-gray-700' : 'bg-purple-600 active:opacity-75'
              }`}
            >
              {isPending || connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base capitalize">
                  {!walletAddress ? 'Connect Wallet' : activeTab === 'claim' ? 'Claim Yield' : activeTab}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Tier ladder */}
        <View className="bg-gray-900 rounded-xl p-4">
          <Text className="text-white text-base font-bold mb-3">Tier Ladder</Text>
          <View className="gap-3">
            {TIER_LADDER.map((item) => {
              const isActive = position?.tier === item.tier;
              return (
                <View
                  key={item.tier}
                  className={`flex-row items-start gap-3 p-3 rounded-xl ${
                    isActive ? 'border border-purple-600 bg-gray-800' : 'bg-gray-800'
                  }`}
                >
                  <StakingTierBadge tier={item.tier} size="sm" />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white text-sm font-semibold">{item.threshold} $SUMMON</Text>
                      {isActive && (
                        <View className="bg-purple-600 rounded px-1.5 py-0.5">
                          <Text className="text-white text-xs">Current</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-400 text-xs mt-0.5">{item.perks}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import StakingTierBadge from '../src/components/StakingTierBadge';
import { useWallet } from '../src/hooks/useWallet';
import { useStakingPosition } from '../src/hooks/useStaking';
import { useQuery } from '@tanstack/react-query';
import { fetchBackerSlots, fetchGovernanceVotes } from '../src/api/smmn-client';

export default function DashboardScreen() {
  const router = useRouter();
  const { walletAddress, connect, connecting } = useWallet();

  const { data: slots, isLoading: slotsLoading } = useQuery({
    queryKey: ['backerSlots', walletAddress],
    queryFn: () => fetchBackerSlots(walletAddress!),
    enabled: walletAddress !== null,
  });

  const { data: votes, isLoading: votesLoading } = useQuery({
    queryKey: ['governance', walletAddress],
    queryFn: () => fetchGovernanceVotes(walletAddress!),
    enabled: walletAddress !== null,
  });

  const { data: staking } = useStakingPosition(walletAddress);

  if (!walletAddress) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center px-6">
        <Text className="text-white text-xl font-bold mb-2 text-center">
          Connect your wallet
        </Text>
        <Text className="text-gray-400 text-center mb-6">
          Connect your Solana wallet to view your VVIP NFTs, votes, and staking.
        </Text>
        <Pressable
          onPress={() => { void connect(); }}
          disabled={connecting}
          className="bg-purple-600 rounded-xl px-8 py-3 active:opacity-75"
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Connect Wallet</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-950">
      <View className="px-4 pt-4 pb-10 gap-4">

        {/* My VVIP NFTs grid */}
        <View className="bg-gray-900 rounded-xl p-4">
          <Text className="text-white text-base font-bold mb-3">My VVIP NFTs</Text>

          {slotsLoading && (
            <ActivityIndicator color="#a855f7" />
          )}

          {!slotsLoading && (!slots || slots.length === 0) && (
            <View className="py-4 items-center">
              <Text className="text-gray-400 text-sm">No VVIP NFTs yet.</Text>
              <Pressable
                onPress={() => router.push('/events')}
                className="mt-3 bg-purple-600 rounded-lg px-4 py-2 active:opacity-75"
              >
                <Text className="text-white text-sm font-semibold">Browse Events</Text>
              </Pressable>
            </View>
          )}

          {slots && slots.length > 0 && (
            <View className="flex-row flex-wrap gap-3">
              {slots.map((slot) => (
                <Pressable
                  key={slot.id}
                  onPress={() => router.push(`/events/${slot.eventId}`)}
                  className="bg-gray-800 rounded-xl w-[47%] overflow-hidden active:opacity-75"
                >
                  {/* Placeholder image area */}
                  <View className="bg-purple-900 h-24 items-center justify-center">
                    <Text className="text-purple-300 text-2xl">🎵</Text>
                  </View>
                  <View className="p-2">
                    <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                      Slot #{slot.slotIndex}
                    </Text>
                    <Text className="text-gray-400 text-xs" numberOfLines={1}>
                      {new Date(slot.purchasedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    {slot.paidOut && (
                      <View className="mt-1 bg-green-900 rounded px-1.5 py-0.5 self-start">
                        <Text className="text-green-400 text-xs">Paid out</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Governance votes */}
        <View className="bg-gray-900 rounded-xl p-4">
          <Text className="text-white text-base font-bold mb-3">Governance Votes</Text>

          {votesLoading && <ActivityIndicator color="#a855f7" />}

          {!votesLoading && (!votes || votes.length === 0) && (
            <Text className="text-gray-400 text-sm py-2">No active votes.</Text>
          )}

          {votes && votes.map((vote) => (
            <View key={vote.id} className="mb-3 border border-gray-800 rounded-xl p-3">
              <Text className="text-white text-sm font-semibold mb-1" numberOfLines={2}>
                {vote.title}
              </Text>
              <Text className="text-gray-400 text-xs mb-2">
                Ends {new Date(vote.endsAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              {vote.userVoted ? (
                <View className="bg-gray-800 rounded-lg px-3 py-1.5 self-start">
                  <Text className="text-gray-400 text-xs">Voted</Text>
                </View>
              ) : (
                <Pressable className="bg-purple-600 rounded-lg px-3 py-1.5 self-start active:opacity-75">
                  <Text className="text-white text-xs font-semibold">Vote Now</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {/* Staking summary */}
        <Pressable
          onPress={() => router.push('/stake')}
          className="bg-gray-900 rounded-xl p-4 active:opacity-80"
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-white text-base font-bold">Staking</Text>
            <Text className="text-purple-400 text-sm">Manage →</Text>
          </View>
          {staking ? (
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-400 text-sm">Staked</Text>
                <Text className="text-white font-semibold">
                  {Number(staking.stakedAmount).toLocaleString()} $SUMMON
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-400 text-sm">Earned yield</Text>
                <Text className="text-green-400 font-semibold">
                  +{Number(staking.earnedYield).toLocaleString()} $SUMMON
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <Text className="text-gray-400 text-sm">Tier</Text>
                <StakingTierBadge tier={staking.tier} size="sm" />
              </View>
            </View>
          ) : (
            <Text className="text-gray-400 text-sm">Stake $SUMMON to earn yield and unlock tiers.</Text>
          )}
        </Pressable>

      </View>
    </ScrollView>
  );
}

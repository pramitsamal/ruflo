import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStakingPosition,
  stakeTokens,
  unstakeTokens,
  claimYield,
  type StakingPosition,
} from '../api/smmn-client';

export function useStakingPosition(wallet: string | null) {
  return useQuery<StakingPosition, Error>({
    queryKey: ['staking', wallet],
    queryFn: () => getStakingPosition(wallet!),
    enabled: wallet !== null && wallet.length > 0,
    staleTime: 60_000,
  });
}

export function useStake() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { wallet: string; amount: string }>({
    mutationFn: ({ wallet, amount }) => stakeTokens(wallet, amount),
    onSuccess: (_data, { wallet }) => {
      void queryClient.invalidateQueries({ queryKey: ['staking', wallet] });
    },
  });
}

export function useUnstake() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { wallet: string; amount: string }>({
    mutationFn: ({ wallet, amount }) => unstakeTokens(wallet, amount),
    onSuccess: (_data, { wallet }) => {
      void queryClient.invalidateQueries({ queryKey: ['staking', wallet] });
    },
  });
}

export function useClaimYield() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { wallet: string }>({
    mutationFn: ({ wallet }) => claimYield(wallet),
    onSuccess: (_data, { wallet }) => {
      void queryClient.invalidateQueries({ queryKey: ['staking', wallet] });
    },
  });
}

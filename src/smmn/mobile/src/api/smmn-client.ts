const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5173';

export interface SMMNEvent {
  id: string;
  artist: string;
  city: string;
  country: string;
  date: string;
  venue: string;
  guarantee: number;
  slotsTotal: number;
  slotsFilled: number;
  slotPrice: number;
  status: 'open' | 'filled' | 'in_production' | 'completed' | 'cancelled';
  genre: string[];
  coverImage?: string;
  description?: string;
  budget?: number;
  projectedRevenue?: number;
}

export interface BackerSlot {
  id: string;
  eventId: string;
  walletAddress: string;
  slotIndex: number;
  mintAddress: string;
  purchasedAt: string;
  paidOut: boolean;
  payoutAmount?: number;
}

export interface StakingPosition {
  wallet: string;
  stakedAmount: string;
  tier: 'none' | 'bronze' | 'silver' | 'gold';
  earnedYield: string;
  stakedAt: string | null;
  unlockAt: string | null;
}

export interface GovernanceVote {
  id: string;
  title: string;
  description: string;
  endsAt: string;
  options: string[];
  userVoted: boolean;
}

export interface PlatformStats {
  totalEventsBackd: number;
  totalGuarantees: number;
  totalBackers: number;
  totalNFTs: number;
  totalStaked: string;
  stakingApy: number;
  totalStakers: number;
  nextYieldDate: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SMMN API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchEvents(status?: string): Promise<SMMNEvent[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<SMMNEvent[]>(`/api/events${query}`);
}

export async function fetchEvent(id: string): Promise<SMMNEvent> {
  return request<SMMNEvent>(`/api/events/${encodeURIComponent(id)}`);
}

export async function purchaseBackerSlot(
  eventId: string,
  walletAddress: string,
): Promise<BackerSlot> {
  return request<BackerSlot>('/api/backer-slots', {
    method: 'POST',
    body: JSON.stringify({ eventId, walletAddress }),
  });
}

export async function fetchBackerSlots(wallet: string): Promise<BackerSlot[]> {
  return request<BackerSlot[]>(`/api/backer-slots?wallet=${encodeURIComponent(wallet)}`);
}

export async function getStakingPosition(wallet: string): Promise<StakingPosition> {
  return request<StakingPosition>(`/api/staking/${encodeURIComponent(wallet)}`);
}

export async function stakeTokens(wallet: string, amount: string): Promise<void> {
  await request<void>('/api/staking/stake', {
    method: 'POST',
    body: JSON.stringify({ wallet, amount }),
  });
}

export async function unstakeTokens(wallet: string, amount: string): Promise<void> {
  await request<void>('/api/staking/unstake', {
    method: 'POST',
    body: JSON.stringify({ wallet, amount }),
  });
}

export async function claimYield(wallet: string): Promise<void> {
  await request<void>('/api/staking/claim', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  return request<PlatformStats>('/api/stats');
}

export async function fetchGovernanceVotes(wallet?: string): Promise<GovernanceVote[]> {
  const query = wallet ? `?wallet=${encodeURIComponent(wallet)}` : '';
  return request<GovernanceVote[]>(`/api/governance${query}`);
}

export async function castVote(
  voteId: string,
  option: string,
  wallet: string,
): Promise<void> {
  await request<void>(`/api/governance/${encodeURIComponent(voteId)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option, wallet }),
  });
}

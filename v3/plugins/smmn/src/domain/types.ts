/**
 * SMMN Domain Types
 *
 * Core domain models for the SMMN Solana-based live events co-creation platform.
 * Covers events, backer rounds, NFT slots, staking, revenue, and artist entities.
 *
 * @module v3/plugins/smmn/domain/types
 */

// =============================================================================
// Event Status & Core Event
// =============================================================================

export type EventStatus =
  | 'draft'
  | 'backer_round_open'
  | 'backer_round_filled'
  | 'in_production'
  | 'completed'
  | 'cancelled';

export interface SMMNEvent {
  id: string;
  artistId: string;
  artistName: string;
  /** Artist guarantee in USD */
  artistGuarantee: number;
  /** Solana pubkey of on-chain backer round program */
  backerRoundAddress?: string;
  status: EventStatus;
  city: string;
  country: string;
  venue?: string;
  eventDate?: Date;
  capacity: number;
  productionBudget: number;
  backerRound?: BackerRound;
  ticketTiers: TicketTier[];
  sponsorships: SponsorshipDeal[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Backer Round
// =============================================================================

export interface BackerRound {
  eventId: string;
  onChainAddress: string;
  totalSlots: number;
  filledSlots: number;
  /** Slot price in USD */
  slotPrice: number;
  /** Platform fee: 10% of artist guarantee */
  platformFee: number;
  status: 'open' | 'filled' | 'cancelled' | 'finalized';
  deadline: Date;
  backers: BackerSlot[];
}

export interface BackerSlot {
  backerId: string;
  walletAddress: string;
  nftMintAddress: string;
  slotIndex: number;
  /** Amount paid in USD */
  paidAmount: number;
  purchasedAt: Date;
  nftMetadataUri?: string;
}

// =============================================================================
// Ticket Tiers & Sponsorships
// =============================================================================

export interface TicketTier {
  /** e.g. 'GA', 'VIP', 'Premium' */
  name: string;
  /** Price in USD */
  price: number;
  quantity: number;
  sold: number;
}

export interface SponsorshipDeal {
  id: string;
  brandName: string;
  /** Amount in USD */
  amount: number;
  /** e.g. 'crypto', 'beverage', 'apparel' */
  category: string;
  status: 'pending' | 'confirmed' | 'paid';
}

// =============================================================================
// $SUMMON Token & Staking
// =============================================================================

export interface SummonToken {
  mintAddress: string;
  /** 100_000_000_000_000n — 100M with 6 decimals */
  totalSupply: bigint;
  /** 6 decimal places */
  decimals: number;
  stakingProgramAddress: string;
}

export type StakingTierLevel = 'none' | 'bronze' | 'silver' | 'gold';

export interface StakingPosition {
  walletAddress: string;
  /** Amount staked in base units (6 decimals) */
  amountStaked: bigint;
  tier: StakingTierLevel;
  stakedAt: Date;
  pendingYield: bigint;
}

/**
 * Tier thresholds in base units (6 decimals).
 * bronze = 1,000 SUMMON, silver = 5,000 SUMMON, gold = 25,000 SUMMON
 */
export const STAKING_TIERS = {
  bronze: { threshold: 1_000_000_000n, benefit: 'priority_access' as const },
  silver: { threshold: 5_000_000_000n, benefit: 'guaranteed_slot' as const },
  gold: { threshold: 25_000_000_000n, benefit: 'vvip_plus_meet_greet' as const },
} as const;

// =============================================================================
// Revenue & Analytics
// =============================================================================

export type RevenueSource = 'backer' | 'sponsorship' | 'ticket' | 'merchandise';

export interface EventRevenue {
  eventId: string;
  entries: RevenueEntry[];
  totalRevenue: number;
  lastUpdatedAt: Date;
}

export interface RevenueEntry {
  id: string;
  source: RevenueSource;
  amount: number;
  recordedAt: Date;
  description?: string;
}

export interface RevenueWaterfall {
  eventId: string;
  totalRevenue: number;
  productionCosts: number;
  sponsorRepayment: number;
  /** 20% token buyback */
  buybackAllocation: number;
  /** 30% staking rewards pool */
  stakingAllocation: number;
  /** 50% SMMN + partners */
  smmnAllocation: number;
  netAfterCosts: number;
}

export interface DistributionResult {
  eventId: string;
  txSignature: string;
  waterfall: RevenueWaterfall;
  distributedAt: Date;
}

export interface EventAnalytics {
  eventId: string;
  artistGuarantee: number;
  productionBudget: number;
  backerRevenue: number;
  sponsorshipRevenue: number;
  ticketRevenue: number;
  totalRevenue: number;
  grossProfit: number;
  smmnShare: number;
  /** Margin as a percentage */
  margin: number;
}

// =============================================================================
// Artist
// =============================================================================

export interface Artist {
  id: string;
  name: string;
  genre: string[];
  walletAddress?: string;
  socialHandles?: Record<string, string>;
  /** Array of event IDs */
  pastEvents: string[];
  /** Score 0-100 */
  reputationScore: number;
}

// =============================================================================
// Configuration
// =============================================================================

export interface SMMNConfig {
  solanaRpcUrl: string;
  solanaNetwork: 'mainnet-beta' | 'devnet' | 'localnet';
  programs: {
    backerRound: string;
    revenueShare: string;
    nftUtility: string;
    summonToken: string;
    staking: string;
  };
  /** 1000 = 10% */
  platformFeeBps: number;
  /** 2000 = 20% */
  sponsorshipCommissionBps: number;
}

// =============================================================================
// Input DTOs
// =============================================================================

export interface CreateEventInput {
  artistId: string;
  artistName: string;
  artistGuarantee: number;
  city: string;
  country: string;
  capacity: number;
  productionBudget: number;
  venue?: string;
  eventDate?: Date;
  ticketTiers?: TicketTier[];
}

export interface BackerRoundConfig {
  totalSlots: number;
  slotPrice: number;
  deadline: Date;
}

export interface EventFilter {
  status?: EventStatus;
  city?: string;
  artistId?: string;
}

// =============================================================================
// Agent Types
// =============================================================================

export interface ViabilityReport {
  eventId: string;
  viable: boolean;
  confidence: number;
  risks: string[];
  recommendations: string[];
  estimatedFillDays: number;
}

export interface ProfitabilityProjection {
  eventId: string;
  projectedRevenue: number;
  projectedCosts: number;
  projectedMargin: number;
  scenarios: {
    pessimistic: number;
    base: number;
    optimistic: number;
  };
}

export interface RoundStatus {
  eventId: string;
  filledPct: number;
  daysRemaining: number;
  fillRatePerDay: number;
  projectedFillDate: Date | null;
  isOnTrack: boolean;
}

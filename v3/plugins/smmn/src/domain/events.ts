/**
 * SMMN Domain Events
 *
 * Domain events for the SMMN platform following event sourcing pattern (ADR-007).
 * All state changes emit events for audit trail and projections.
 *
 * @module v3/plugins/smmn/domain/events
 */

import type {
  SMMNEvent,
  BackerSlot,
  StakingPosition,
  RevenueSource,
  RevenueWaterfall,
  EventStatus,
} from './types.js';

// =============================================================================
// Base Domain Event
// =============================================================================

export interface SMMNDomainEvent {
  /** Unique event identifier */
  id: string;
  /** Event type discriminator */
  type: SMMNEventType;
  /** Aggregate ID */
  aggregateId: string;
  /** Aggregate type */
  aggregateType: 'smmn_event' | 'backer_round' | 'staking' | 'revenue';
  /** Version for ordering within aggregate */
  version: number;
  /** Unix timestamp ms */
  timestamp: number;
  /** Source service */
  source: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  causationId?: string;
  correlationId?: string;
}

// =============================================================================
// Event Types
// =============================================================================

export type SMMNEventType =
  | 'event:created'
  | 'event:status_changed'
  | 'event:completed'
  | 'backer_round:initialized'
  | 'backer_round:slot_purchased'
  | 'backer_round:filled'
  | 'backer_round:finalized'
  | 'backer_round:cancelled'
  | 'artist_fee:paid'
  | 'revenue:recorded'
  | 'profit:distributed'
  | 'tokens:staked'
  | 'tokens:unstaked'
  | 'yield:claimed';

// =============================================================================
// Specific Event Interfaces
// =============================================================================

export interface EventCreatedEvent extends SMMNDomainEvent {
  type: 'event:created';
  payload: {
    eventId: string;
    artistId: string;
    artistName: string;
    artistGuarantee: number;
    city: string;
    capacity: number;
    productionBudget: number;
    createdAt: number;
  };
}

export interface EventStatusChangedEvent extends SMMNDomainEvent {
  type: 'event:status_changed';
  payload: {
    eventId: string;
    previousStatus: EventStatus;
    newStatus: EventStatus;
    changedAt: number;
    reason?: string;
  };
}

export interface EventCompletedEvent extends SMMNDomainEvent {
  type: 'event:completed';
  payload: {
    eventId: string;
    completedAt: number;
    totalRevenue: number;
    attendanceCount: number;
  };
}

export interface BackerRoundInitializedEvent extends SMMNDomainEvent {
  type: 'backer_round:initialized';
  payload: {
    eventId: string;
    onChainAddress: string;
    totalSlots: number;
    slotPrice: number;
    platformFee: number;
    deadline: number;
    initializedAt: number;
  };
}

export interface SlotPurchasedEvent extends SMMNDomainEvent {
  type: 'backer_round:slot_purchased';
  payload: {
    eventId: string;
    backerId: string;
    walletAddress: string;
    slotIndex: number;
    nftMintAddress: string;
    paidAmount: number;
    purchasedAt: number;
    filledSlots: number;
    totalSlots: number;
  };
}

export interface BackerRoundFilledEvent extends SMMNDomainEvent {
  type: 'backer_round:filled';
  payload: {
    eventId: string;
    onChainAddress: string;
    filledAt: number;
    totalCollected: number;
    backerCount: number;
  };
}

export interface BackerRoundFinalizedEvent extends SMMNDomainEvent {
  type: 'backer_round:finalized';
  payload: {
    eventId: string;
    txSignature: string;
    artistFeeReleased: number;
    finalizedAt: number;
  };
}

export interface BackerRoundCancelledEvent extends SMMNDomainEvent {
  type: 'backer_round:cancelled';
  payload: {
    eventId: string;
    reason: string;
    cancelledAt: number;
    refundCount: number;
  };
}

export interface ArtistFeePaidEvent extends SMMNDomainEvent {
  type: 'artist_fee:paid';
  payload: {
    eventId: string;
    artistId: string;
    walletAddress: string;
    amount: number;
    txSignature: string;
    paidAt: number;
  };
}

export interface RevenueRecordedEvent extends SMMNDomainEvent {
  type: 'revenue:recorded';
  payload: {
    eventId: string;
    source: RevenueSource;
    amount: number;
    cumulativeTotal: number;
    recordedAt: number;
    description?: string;
  };
}

export interface ProfitDistributedEvent extends SMMNDomainEvent {
  type: 'profit:distributed';
  payload: {
    eventId: string;
    waterfall: RevenueWaterfall;
    txSignature: string;
    distributedAt: number;
  };
}

export interface TokensStakedEvent extends SMMNDomainEvent {
  type: 'tokens:staked';
  payload: {
    walletAddress: string;
    amount: string;         // bigint serialized as string
    newTotal: string;
    tier: string;
    txSignature: string;
    stakedAt: number;
  };
}

export interface TokensUnstakedEvent extends SMMNDomainEvent {
  type: 'tokens:unstaked';
  payload: {
    walletAddress: string;
    amount: string;
    newTotal: string;
    tier: string;
    txSignature: string;
    unstakedAt: number;
  };
}

export interface YieldClaimedEvent extends SMMNDomainEvent {
  type: 'yield:claimed';
  payload: {
    walletAddress: string;
    amount: string;
    txSignature: string;
    claimedAt: number;
  };
}

// =============================================================================
// Union Type
// =============================================================================

export type AllSMMNEvents =
  | EventCreatedEvent
  | EventStatusChangedEvent
  | EventCompletedEvent
  | BackerRoundInitializedEvent
  | SlotPurchasedEvent
  | BackerRoundFilledEvent
  | BackerRoundFinalizedEvent
  | BackerRoundCancelledEvent
  | ArtistFeePaidEvent
  | RevenueRecordedEvent
  | ProfitDistributedEvent
  | TokensStakedEvent
  | TokensUnstakedEvent
  | YieldClaimedEvent;

// =============================================================================
// Event Factory
// =============================================================================

let eventCounter = 0;

function generateEventId(): string {
  return `smmn-evt-${Date.now()}-${++eventCounter}`;
}

function createSMMNEvent<T extends SMMNDomainEvent>(
  type: T['type'],
  aggregateId: string,
  aggregateType: T['aggregateType'],
  source: string,
  payload: T['payload'],
  metadata?: Record<string, unknown>
): T {
  return {
    id: generateEventId(),
    type,
    aggregateId,
    aggregateType,
    version: 1,
    timestamp: Date.now(),
    source,
    payload,
    metadata,
  } as T;
}

// =============================================================================
// Public Factory Functions
// =============================================================================

export function createEventCreatedEvent(
  event: Pick<SMMNEvent, 'id' | 'artistId' | 'artistName' | 'artistGuarantee' | 'city' | 'capacity' | 'productionBudget'>
): EventCreatedEvent {
  return createSMMNEvent('event:created', event.id, 'smmn_event', 'event-service', {
    eventId: event.id,
    artistId: event.artistId,
    artistName: event.artistName,
    artistGuarantee: event.artistGuarantee,
    city: event.city,
    capacity: event.capacity,
    productionBudget: event.productionBudget,
    createdAt: Date.now(),
  });
}

export function createEventStatusChangedEvent(
  eventId: string,
  previousStatus: EventStatus,
  newStatus: EventStatus,
  reason?: string
): EventStatusChangedEvent {
  return createSMMNEvent('event:status_changed', eventId, 'smmn_event', 'event-service', {
    eventId,
    previousStatus,
    newStatus,
    changedAt: Date.now(),
    reason,
  });
}

export function createBackerRoundInitializedEvent(
  eventId: string,
  onChainAddress: string,
  totalSlots: number,
  slotPrice: number,
  platformFee: number,
  deadline: Date
): BackerRoundInitializedEvent {
  return createSMMNEvent('backer_round:initialized', eventId, 'backer_round', 'backer-round-service', {
    eventId,
    onChainAddress,
    totalSlots,
    slotPrice,
    platformFee,
    deadline: deadline.getTime(),
    initializedAt: Date.now(),
  });
}

export function createSlotPurchasedEvent(slot: BackerSlot & { eventId: string; filledSlots: number; totalSlots: number }): SlotPurchasedEvent {
  return createSMMNEvent('backer_round:slot_purchased', slot.eventId, 'backer_round', 'backer-round-service', {
    eventId: slot.eventId,
    backerId: slot.backerId,
    walletAddress: slot.walletAddress,
    slotIndex: slot.slotIndex,
    nftMintAddress: slot.nftMintAddress,
    paidAmount: slot.paidAmount,
    purchasedAt: slot.purchasedAt.getTime(),
    filledSlots: slot.filledSlots,
    totalSlots: slot.totalSlots,
  });
}

export function createArtistFeePaidEvent(
  eventId: string,
  artistId: string,
  walletAddress: string,
  amount: number,
  txSignature: string
): ArtistFeePaidEvent {
  return createSMMNEvent('artist_fee:paid', eventId, 'smmn_event', 'backer-round-service', {
    eventId,
    artistId,
    walletAddress,
    amount,
    txSignature,
    paidAt: Date.now(),
  });
}

export function createRevenueRecordedEvent(
  eventId: string,
  source: RevenueSource,
  amount: number,
  cumulativeTotal: number,
  description?: string
): RevenueRecordedEvent {
  return createSMMNEvent('revenue:recorded', eventId, 'revenue', 'revenue-service', {
    eventId,
    source,
    amount,
    cumulativeTotal,
    recordedAt: Date.now(),
    description,
  });
}

export function createProfitDistributedEvent(
  eventId: string,
  waterfall: RevenueWaterfall,
  txSignature: string
): ProfitDistributedEvent {
  return createSMMNEvent('profit:distributed', eventId, 'revenue', 'revenue-service', {
    eventId,
    waterfall,
    txSignature,
    distributedAt: Date.now(),
  });
}

export function createTokensStakedEvent(
  position: StakingPosition,
  txSignature: string
): TokensStakedEvent {
  return createSMMNEvent('tokens:staked', position.walletAddress, 'staking', 'staking-service', {
    walletAddress: position.walletAddress,
    amount: position.amountStaked.toString(),
    newTotal: position.amountStaked.toString(),
    tier: position.tier,
    txSignature,
    stakedAt: Date.now(),
  });
}

export function createTokensUnstakedEvent(
  walletAddress: string,
  amount: bigint,
  newTotal: bigint,
  tier: string,
  txSignature: string
): TokensUnstakedEvent {
  return createSMMNEvent('tokens:unstaked', walletAddress, 'staking', 'staking-service', {
    walletAddress,
    amount: amount.toString(),
    newTotal: newTotal.toString(),
    tier,
    txSignature,
    unstakedAt: Date.now(),
  });
}

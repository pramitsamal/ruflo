/**
 * SMMN Repository Interfaces
 *
 * Repository interfaces for the SMMN domain following DDD patterns.
 * All repositories follow the Repository pattern for aggregate persistence.
 *
 * @module v3/plugins/smmn/domain/repositories
 */

import type {
  SMMNEvent,
  BackerSlot,
  Artist,
  EventFilter,
  EventAnalytics,
  EventRevenue,
  StakingPosition,
  EventStatus,
} from './types.js';

// =============================================================================
// Event Repository
// =============================================================================

/**
 * Repository for SMMNEvent aggregates
 */
export interface IEventRepository {
  /** Persist a new event or update an existing one */
  save(event: SMMNEvent): Promise<void>;

  /** Find an event by its ID */
  findById(id: string): Promise<SMMNEvent | null>;

  /** Find events matching optional filters */
  findAll(filter?: EventFilter): Promise<SMMNEvent[]>;

  /** Find events by city */
  findByCity(city: string): Promise<SMMNEvent[]>;

  /** Find events by status */
  findByStatus(status: EventStatus): Promise<SMMNEvent[]>;

  /** Find events by artist */
  findByArtist(artistId: string): Promise<SMMNEvent[]>;

  /** Delete an event (admin only) */
  delete(id: string): Promise<void>;

  /** Initialize the repository */
  initialize(): Promise<void>;

  /** Shutdown the repository */
  shutdown(): Promise<void>;
}

// =============================================================================
// Backer Repository
// =============================================================================

/**
 * Repository for BackerSlot records
 */
export interface IBackerRepository {
  /** Persist a backer slot */
  save(slot: BackerSlot & { eventId: string }): Promise<void>;

  /** Find a backer slot by NFT mint address */
  findByNftMint(nftMintAddress: string): Promise<(BackerSlot & { eventId: string }) | null>;

  /** Find all slots for an event */
  findByEvent(eventId: string): Promise<BackerSlot[]>;

  /** Find all slots for a wallet address */
  findByWallet(walletAddress: string): Promise<(BackerSlot & { eventId: string })[]>;

  /** Count filled slots for an event */
  countByEvent(eventId: string): Promise<number>;

  /** Initialize the repository */
  initialize(): Promise<void>;

  /** Shutdown the repository */
  shutdown(): Promise<void>;
}

// =============================================================================
// Artist Repository
// =============================================================================

/**
 * Repository for Artist aggregates
 */
export interface IArtistRepository {
  /** Persist an artist or update an existing one */
  save(artist: Artist): Promise<void>;

  /** Find an artist by their ID */
  findById(id: string): Promise<Artist | null>;

  /** Find artists by name (partial match) */
  findByName(name: string): Promise<Artist[]>;

  /** Find artists by genre */
  findByGenre(genre: string): Promise<Artist[]>;

  /** Find artists with reputation score at or above threshold */
  findByMinReputation(minScore: number): Promise<Artist[]>;

  /** Delete an artist */
  delete(id: string): Promise<void>;

  /** Initialize the repository */
  initialize(): Promise<void>;

  /** Shutdown the repository */
  shutdown(): Promise<void>;
}

// =============================================================================
// Analytics Repository
// =============================================================================

/**
 * Read-only repository for analytics queries
 */
export interface IAnalyticsRepository {
  /** Get full P&L analytics for an event */
  getEventAnalytics(eventId: string): Promise<EventAnalytics | null>;

  /** Get revenue breakdown for an event */
  getEventRevenue(eventId: string): Promise<EventRevenue | null>;

  /** Get top-performing events by margin */
  getTopEventsByMargin(limit?: number): Promise<EventAnalytics[]>;

  /** Get platform-wide revenue total */
  getPlatformRevenue(): Promise<number>;

  /** Get total staking positions */
  getTotalStaked(): Promise<bigint>;

  /** Get staking position for a wallet */
  getStakingPosition(walletAddress: string): Promise<StakingPosition | null>;

  /** Initialize the repository */
  initialize(): Promise<void>;

  /** Shutdown the repository */
  shutdown(): Promise<void>;
}

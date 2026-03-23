/**
 * SMMN Backer Round Service
 *
 * Manages backer round lifecycle: launching on-chain rounds,
 * processing slot purchases (with VVIP NFT minting), finalization,
 * and cancellation.
 *
 * @module v3/plugins/smmn/application/backer-round.service
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import type {
  BackerRound,
  BackerSlot,
  BackerRoundConfig,
  SMMNConfig,
} from '../domain/types.js';
import type { IEventRepository, IBackerRepository } from '../domain/repositories.js';
import {
  createBackerRoundInitializedEvent,
  createSlotPurchasedEvent,
  createArtistFeePaidEvent,
  createEventStatusChangedEvent,
} from '../domain/events.js';

// =============================================================================
// Validation
// =============================================================================

const LaunchSchema = z.object({
  totalSlots: z.number().int().min(1).max(500),
  slotPrice: z.number().positive(),
  deadline: z.date().refine((d) => d > new Date(), 'Deadline must be in the future'),
});

const PurchaseSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address'),
});

// =============================================================================
// Error Types
// =============================================================================

export class BackerRoundError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BackerRoundError';
  }
}

export class RoundNotOpenError extends BackerRoundError {
  constructor(eventId: string) {
    super(`Backer round for event ${eventId} is not open`);
    this.name = 'RoundNotOpenError';
  }
}

export class RoundFullError extends BackerRoundError {
  constructor(eventId: string) {
    super(`Backer round for event ${eventId} is full`);
    this.name = 'RoundFullError';
  }
}

// =============================================================================
// Dependency Interfaces
// =============================================================================

interface MemoryService {
  store(key: string, value: unknown, namespace?: string): Promise<void>;
}

interface NftMinter {
  mintVVIP(params: {
    recipient: string;
    eventId: string;
    eventName: string;
    slotIndex: number;
    metadataUri: string;
  }): Promise<{ mintAddress: string; txSignature: string }>;
}

// =============================================================================
// Backer Round Service
// =============================================================================

export class BackerRoundService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly backerRepo: IBackerRepository,
    private readonly memory: MemoryService,
    private readonly nftMinter: NftMinter,
    private readonly config: Pick<SMMNConfig, 'platformFeeBps'>
  ) {}

  /**
   * Launch an on-chain backer round for the given event.
   * Transitions event status to 'backer_round_open'.
   */
  async launchBackerRound(
    eventId: string,
    roundConfig: BackerRoundConfig
  ): Promise<BackerRound> {
    const validated = LaunchSchema.parse(roundConfig);

    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new BackerRoundError(`Event not found: ${eventId}`);
    if (event.status !== 'draft') {
      throw new BackerRoundError(
        `Event must be in draft status to launch backer round (current: ${event.status})`
      );
    }

    const platformFee =
      (event.artistGuarantee * this.config.platformFeeBps) / 10_000;

    // In production this would call loadBackerRoundProgram and build a Solana tx.
    // Here we generate a deterministic-looking address for the on-chain account.
    const onChainAddress = `SMMN_BR_${eventId.slice(0, 8)}_${Date.now()}`;

    const round: BackerRound = {
      eventId,
      onChainAddress,
      totalSlots: validated.totalSlots,
      filledSlots: 0,
      slotPrice: validated.slotPrice,
      platformFee,
      status: 'open',
      deadline: validated.deadline,
      backers: [],
    };

    const updatedEvent = {
      ...event,
      status: 'backer_round_open' as const,
      backerRound: round,
      backerRoundAddress: onChainAddress,
      updatedAt: new Date(),
    };

    await this.eventRepo.save(updatedEvent);

    // Emit domain events
    const initEvent = createBackerRoundInitializedEvent(
      eventId,
      onChainAddress,
      validated.totalSlots,
      validated.slotPrice,
      platformFee,
      validated.deadline
    );
    const statusEvent = createEventStatusChangedEvent(
      eventId,
      'draft',
      'backer_round_open'
    );

    await this.memory.store(
      `backer_round:${eventId}:initialized`,
      initEvent,
      'smmn-events'
    );
    await this.memory.store(
      `event:${eventId}:status_changed:open`,
      statusEvent,
      'smmn-events'
    );

    return round;
  }

  /**
   * Purchase a backer slot for a wallet and mint a VVIP NFT.
   * Returns the populated BackerSlot with NFT mint address.
   */
  async purchaseSlot(
    eventId: string,
    walletAddress: string
  ): Promise<BackerSlot> {
    PurchaseSchema.parse({ walletAddress });

    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new BackerRoundError(`Event not found: ${eventId}`);
    if (!event.backerRound) throw new RoundNotOpenError(eventId);

    const round = event.backerRound;
    if (round.status !== 'open') throw new RoundNotOpenError(eventId);
    if (round.filledSlots >= round.totalSlots) throw new RoundFullError(eventId);
    if (new Date() > round.deadline) {
      throw new BackerRoundError(`Backer round deadline has passed for event ${eventId}`);
    }

    const slotIndex = round.filledSlots + 1;

    // Mint VVIP NFT for this slot
    const { mintAddress: nftMintAddress } = await this.nftMinter.mintVVIP({
      recipient: walletAddress,
      eventId,
      eventName: event.artistName,
      slotIndex,
      metadataUri: `https://smmn.io/metadata/${eventId}/${slotIndex}`,
    });

    const now = new Date();
    const slot: BackerSlot = {
      backerId: randomUUID(),
      walletAddress,
      nftMintAddress,
      slotIndex,
      paidAmount: round.slotPrice,
      purchasedAt: now,
      nftMetadataUri: `https://smmn.io/metadata/${eventId}/${slotIndex}`,
    };

    await this.backerRepo.save({ ...slot, eventId });

    // Update round state
    const updatedSlots = round.filledSlots + 1;
    const newRoundStatus =
      updatedSlots >= round.totalSlots ? 'filled' : 'open';

    const updatedRound: BackerRound = {
      ...round,
      filledSlots: updatedSlots,
      status: newRoundStatus,
      backers: [...round.backers, slot],
    };

    const updatedEvent = {
      ...event,
      backerRound: updatedRound,
      status: newRoundStatus === 'filled'
        ? ('backer_round_filled' as const)
        : event.status,
      updatedAt: now,
    };

    await this.eventRepo.save(updatedEvent);

    // Emit domain event
    const domainEvent = createSlotPurchasedEvent({
      ...slot,
      eventId,
      filledSlots: updatedSlots,
      totalSlots: round.totalSlots,
    });
    await this.memory.store(
      `backer_round:${eventId}:slot:${slotIndex}`,
      domainEvent,
      'smmn-events'
    );

    return slot;
  }

  /**
   * Finalize the backer round: release artist fees and advance event status.
   * Returns the on-chain transaction signature.
   */
  async finalizeRound(eventId: string): Promise<string> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new BackerRoundError(`Event not found: ${eventId}`);
    if (!event.backerRound) throw new BackerRoundError(`No backer round for event ${eventId}`);

    const round = event.backerRound;
    if (round.status !== 'filled' && round.status !== 'open') {
      throw new BackerRoundError(`Round cannot be finalized in status: ${round.status}`);
    }

    // In production this calls the Anchor program's finalize instruction
    const txSignature = `finalize_${eventId}_${Date.now()}`;

    const updatedRound: BackerRound = { ...round, status: 'finalized' };
    const updatedEvent = {
      ...event,
      backerRound: updatedRound,
      status: 'in_production' as const,
      updatedAt: new Date(),
    };

    await this.eventRepo.save(updatedEvent);

    // Emit artist fee paid event
    const artistFeeEvent = createArtistFeePaidEvent(
      eventId,
      event.artistId,
      '', // wallet address would come from artist record
      event.artistGuarantee,
      txSignature
    );
    await this.memory.store(
      `artist_fee:${eventId}:paid`,
      artistFeeEvent,
      'smmn-events'
    );

    return txSignature;
  }

  /**
   * Cancel an open backer round and refund all backers.
   */
  async cancelRound(eventId: string): Promise<void> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new BackerRoundError(`Event not found: ${eventId}`);
    if (!event.backerRound) throw new BackerRoundError(`No backer round for event ${eventId}`);

    const round = event.backerRound;
    if (round.status === 'finalized') {
      throw new BackerRoundError('Cannot cancel a finalized backer round');
    }

    // In production this would trigger on-chain refunds
    const updatedRound: BackerRound = { ...round, status: 'cancelled' };
    const updatedEvent = {
      ...event,
      backerRound: updatedRound,
      status: 'cancelled' as const,
      updatedAt: new Date(),
    };

    await this.eventRepo.save(updatedEvent);
  }

  /**
   * Get the number of filled backer slots for an event.
   */
  async getBackerCount(eventId: string): Promise<number> {
    return this.backerRepo.countByEvent(eventId);
  }
}

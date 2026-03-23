/**
 * SMMN Revenue Service
 *
 * Tracks event revenue and executes the profit waterfall distribution:
 * 1. Cover production costs + artist guarantee
 * 2. Repay sponsors
 * 3. 20% token buyback
 * 4. 30% staking rewards
 * 5. 50% SMMN + partners
 *
 * @module v3/plugins/smmn/application/revenue.service
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import type {
  EventRevenue,
  RevenueEntry,
  RevenueSource,
  RevenueWaterfall,
  DistributionResult,
  SMMNConfig,
} from '../domain/types.js';
import type { IEventRepository } from '../domain/repositories.js';
import {
  createRevenueRecordedEvent,
  createProfitDistributedEvent,
} from '../domain/events.js';

// =============================================================================
// Validation
// =============================================================================

const RecordRevenueSchema = z.object({
  eventId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  source: z.enum(['backer', 'sponsorship', 'ticket', 'merchandise']),
  description: z.string().optional(),
});

// =============================================================================
// Error Types
// =============================================================================

export class RevenueServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RevenueServiceError';
  }
}

// =============================================================================
// In-Memory Revenue Store (replace with DB-backed repository in production)
// =============================================================================

const revenueStore = new Map<string, EventRevenue>();

function getOrCreateRevenue(eventId: string): EventRevenue {
  if (!revenueStore.has(eventId)) {
    revenueStore.set(eventId, {
      eventId,
      entries: [],
      totalRevenue: 0,
      lastUpdatedAt: new Date(),
    });
  }
  return revenueStore.get(eventId)!;
}

// =============================================================================
// Dependency Interfaces
// =============================================================================

interface MemoryService {
  store(key: string, value: unknown, namespace?: string): Promise<void>;
}

// =============================================================================
// Revenue Service
// =============================================================================

export class RevenueService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly memory: MemoryService,
    private readonly config: Pick<SMMNConfig, 'platformFeeBps' | 'sponsorshipCommissionBps'>
  ) {}

  /**
   * Record a revenue entry for an event.
   * Appends to the event's running revenue total.
   */
  async recordRevenue(
    eventId: string,
    amount: number,
    source: RevenueSource,
    description?: string
  ): Promise<void> {
    RecordRevenueSchema.parse({ eventId, amount, source, description });

    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new RevenueServiceError(`Event not found: ${eventId}`);

    const existing = getOrCreateRevenue(eventId);
    const entry: RevenueEntry = {
      id: randomUUID(),
      source,
      amount,
      recordedAt: new Date(),
      description,
    };

    const updated: EventRevenue = {
      ...existing,
      entries: [...existing.entries, entry],
      totalRevenue: existing.totalRevenue + amount,
      lastUpdatedAt: new Date(),
    };
    revenueStore.set(eventId, updated);

    // Emit domain event
    const domainEvent = createRevenueRecordedEvent(
      eventId,
      source,
      amount,
      updated.totalRevenue,
      description
    );
    await this.memory.store(
      `revenue:${eventId}:${entry.id}`,
      domainEvent,
      'smmn-events'
    );
  }

  /**
   * Calculate the profit waterfall for an event.
   * Returns allocation breakdown without executing any transfers.
   */
  async calculateWaterfall(eventId: string): Promise<RevenueWaterfall> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new RevenueServiceError(`Event not found: ${eventId}`);

    const revenue = getOrCreateRevenue(eventId);

    // Production costs: artist guarantee + production budget
    const productionCosts = event.artistGuarantee + event.productionBudget;

    // Sponsorship repayment (full amount, already received as revenue)
    const sponsorRepayment = revenue.entries
      .filter((e) => e.source === 'sponsorship')
      .reduce((sum, e) => sum + e.amount, 0);

    const afterCosts = Math.max(
      0,
      revenue.totalRevenue - productionCosts - sponsorRepayment
    );

    // Waterfall splits on net profit
    const buybackAllocation = afterCosts * 0.2;
    const stakingAllocation = afterCosts * 0.3;
    const smmnAllocation = afterCosts * 0.5;

    return {
      eventId,
      totalRevenue: revenue.totalRevenue,
      productionCosts,
      sponsorRepayment,
      buybackAllocation,
      stakingAllocation,
      smmnAllocation,
      netAfterCosts: afterCosts,
    };
  }

  /**
   * Execute the profit waterfall distribution.
   * In production this submits Solana transactions.
   * Returns distribution result with transaction signatures.
   */
  async distributeProfit(eventId: string): Promise<DistributionResult> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new RevenueServiceError(`Event not found: ${eventId}`);
    if (event.status !== 'completed') {
      throw new RevenueServiceError(
        `Event must be completed before distributing profits (status: ${event.status})`
      );
    }

    const waterfall = await this.calculateWaterfall(eventId);

    // In production these would be real Solana tx signatures
    const txSignature = `dist_${eventId}_${Date.now()}`;

    const result: DistributionResult = {
      eventId,
      txSignature,
      waterfall,
      distributedAt: new Date(),
    };

    // Emit domain event
    const domainEvent = createProfitDistributedEvent(eventId, waterfall, txSignature);
    await this.memory.store(
      `profit:${eventId}:distributed`,
      domainEvent,
      'smmn-events'
    );

    return result;
  }

  /**
   * Get the current revenue snapshot for an event.
   */
  async getEventRevenue(eventId: string): Promise<EventRevenue> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new RevenueServiceError(`Event not found: ${eventId}`);
    return getOrCreateRevenue(eventId);
  }
}

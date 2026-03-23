/**
 * SMMN Event Service
 *
 * Manages the full lifecycle of SMMN live events including creation,
 * status transitions, and analytics calculation.
 *
 * @module v3/plugins/smmn/application/event.service
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import type {
  SMMNEvent,
  EventStatus,
  EventAnalytics,
  EventFilter,
  CreateEventInput,
} from '../domain/types.js';
import type { IEventRepository } from '../domain/repositories.js';
import {
  createEventCreatedEvent,
  createEventStatusChangedEvent,
} from '../domain/events.js';

// =============================================================================
// Validation
// =============================================================================

const CreateEventSchema = z.object({
  artistId: z.string().min(1, 'artistId required'),
  artistName: z.string().min(1, 'artistName required'),
  artistGuarantee: z.number().positive('artistGuarantee must be positive'),
  city: z.string().min(1, 'city required'),
  country: z.string().min(1, 'country required'),
  capacity: z.number().int().positive('capacity must be a positive integer'),
  productionBudget: z.number().positive('productionBudget must be positive'),
  venue: z.string().optional(),
  eventDate: z.date().optional(),
  ticketTiers: z.array(z.any()).optional(),
});

// =============================================================================
// Error Types
// =============================================================================

export class EventServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'EventServiceError';
  }
}

export class EventNotFoundError extends EventServiceError {
  constructor(id: string) {
    super(`Event not found: ${id}`);
    this.name = 'EventNotFoundError';
  }
}

export class InvalidStatusTransitionError extends EventServiceError {
  constructor(from: EventStatus, to: EventStatus) {
    super(`Invalid status transition: ${from} -> ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

// =============================================================================
// Allowed Status Transitions
// =============================================================================

const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['backer_round_open', 'cancelled'],
  backer_round_open: ['backer_round_filled', 'cancelled'],
  backer_round_filled: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// =============================================================================
// Memory Service Interface (peer dep)
// =============================================================================

interface MemoryService {
  store(key: string, value: unknown, namespace?: string): Promise<void>;
  retrieve(key: string, namespace?: string): Promise<unknown>;
}

// =============================================================================
// Event Service
// =============================================================================

export class EventService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly memory: MemoryService
  ) {}

  /**
   * Create a new SMMN event in draft status.
   * Validates all required fields before persisting.
   */
  async createEvent(input: CreateEventInput): Promise<SMMNEvent> {
    const validated = CreateEventSchema.parse(input);

    const now = new Date();
    const event: SMMNEvent = {
      id: randomUUID(),
      artistId: validated.artistId,
      artistName: validated.artistName,
      artistGuarantee: validated.artistGuarantee,
      status: 'draft',
      city: validated.city,
      country: validated.country,
      venue: validated.venue,
      eventDate: validated.eventDate,
      capacity: validated.capacity,
      productionBudget: validated.productionBudget,
      ticketTiers: validated.ticketTiers ?? [],
      sponsorships: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.eventRepo.save(event);

    // Emit domain event
    const domainEvent = createEventCreatedEvent(event);
    await this.memory.store(
      `event:${event.id}:created`,
      domainEvent,
      'smmn-events'
    );

    return event;
  }

  /**
   * Retrieve a single event by ID.
   * Returns null if not found.
   */
  async getEvent(id: string): Promise<SMMNEvent | null> {
    if (!id) throw new EventServiceError('Event ID is required');
    return this.eventRepo.findById(id);
  }

  /**
   * List events matching an optional filter.
   */
  async listEvents(filter?: EventFilter): Promise<SMMNEvent[]> {
    return this.eventRepo.findAll(filter);
  }

  /**
   * Transition an event to a new status.
   * Validates the transition is allowed before persisting.
   */
  async updateEventStatus(id: string, newStatus: EventStatus): Promise<SMMNEvent> {
    const event = await this.eventRepo.findById(id);
    if (!event) throw new EventNotFoundError(id);

    const allowed = ALLOWED_TRANSITIONS[event.status];
    if (!allowed.includes(newStatus)) {
      throw new InvalidStatusTransitionError(event.status, newStatus);
    }

    const previousStatus = event.status;
    const updated: SMMNEvent = {
      ...event,
      status: newStatus,
      updatedAt: new Date(),
    };

    await this.eventRepo.save(updated);

    // Emit domain event
    const domainEvent = createEventStatusChangedEvent(id, previousStatus, newStatus);
    await this.memory.store(
      `event:${id}:status_changed:${Date.now()}`,
      domainEvent,
      'smmn-events'
    );

    return updated;
  }

  /**
   * Compute P&L analytics for a completed or in-progress event.
   */
  async getEventAnalytics(id: string): Promise<EventAnalytics> {
    const event = await this.eventRepo.findById(id);
    if (!event) throw new EventNotFoundError(id);

    const backerRevenue = event.backerRound
      ? event.backerRound.filledSlots * event.backerRound.slotPrice
      : 0;

    const sponsorshipRevenue = event.sponsorships
      .filter((s) => s.status === 'paid')
      .reduce((sum, s) => sum + s.amount, 0);

    const ticketRevenue = event.ticketTiers.reduce(
      (sum, t) => sum + t.sold * t.price,
      0
    );

    const totalRevenue = backerRevenue + sponsorshipRevenue + ticketRevenue;
    const totalCosts = event.productionBudget + event.artistGuarantee;
    const grossProfit = totalRevenue - totalCosts;

    // SMMN receives 50% of net profit after waterfall deductions
    const smmnShare = grossProfit > 0 ? grossProfit * 0.5 : 0;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      eventId: id,
      artistGuarantee: event.artistGuarantee,
      productionBudget: event.productionBudget,
      backerRevenue,
      sponsorshipRevenue,
      ticketRevenue,
      totalRevenue,
      grossProfit,
      smmnShare,
      margin: Math.round(margin * 100) / 100,
    };
  }
}

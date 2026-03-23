/**
 * EventService Tests
 *
 * Tests for the SMMN EventService using Vitest with mock-first (London School TDD).
 * All external dependencies are mocked.
 *
 * @module v3/plugins/smmn/tests/event.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventService, EventNotFoundError, InvalidStatusTransitionError } from '../src/application/event.service.js';
import type { IEventRepository } from '../src/domain/repositories.js';
import type { SMMNEvent } from '../src/domain/types.js';

// =============================================================================
// Helpers
// =============================================================================

function makeEvent(overrides: Partial<SMMNEvent> = {}): SMMNEvent {
  return {
    id: 'evt-001',
    artistId: 'artist-001',
    artistName: 'Test Artist',
    artistGuarantee: 5000,
    status: 'draft',
    city: 'New York',
    country: 'US',
    capacity: 500,
    productionBudget: 10000,
    ticketTiers: [],
    sponsorships: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeEventRepo(events: SMMNEvent[] = []): IEventRepository {
  const store = new Map<string, SMMNEvent>(events.map((e) => [e.id, e]));
  return {
    save: vi.fn(async (event: SMMNEvent) => { store.set(event.id, event); }),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findAll: vi.fn(async () => Array.from(store.values())),
    findByCity: vi.fn(async (city: string) =>
      Array.from(store.values()).filter((e) => e.city === city)),
    findByStatus: vi.fn(async (status) =>
      Array.from(store.values()).filter((e) => e.status === status)),
    findByArtist: vi.fn(async (artistId) =>
      Array.from(store.values()).filter((e) => e.artistId === artistId)),
    delete: vi.fn(async (id: string) => { store.delete(id); }),
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
  };
}

function makeMemory() {
  return {
    store: vi.fn(async () => {}),
    retrieve: vi.fn(async () => null),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('EventService', () => {
  let repo: IEventRepository;
  let memory: ReturnType<typeof makeMemory>;
  let service: EventService;

  beforeEach(() => {
    repo = makeEventRepo();
    memory = makeMemory();
    service = new EventService(repo, memory);
  });

  // ---------------------------------------------------------------------------
  // createEvent
  // ---------------------------------------------------------------------------

  describe('createEvent', () => {
    it('creates an event in draft status', async () => {
      const event = await service.createEvent({
        artistId: 'artist-001',
        artistName: 'The Test Band',
        artistGuarantee: 5000,
        city: 'London',
        country: 'GB',
        capacity: 1000,
        productionBudget: 20000,
      });

      expect(event.id).toBeTruthy();
      expect(event.status).toBe('draft');
      expect(event.artistName).toBe('The Test Band');
      expect(event.city).toBe('London');
    });

    it('assigns a unique ID to each event', async () => {
      const a = await service.createEvent({
        artistId: 'artist-001',
        artistName: 'Artist A',
        artistGuarantee: 1000,
        city: 'Berlin',
        country: 'DE',
        capacity: 200,
        productionBudget: 5000,
      });
      const b = await service.createEvent({
        artistId: 'artist-002',
        artistName: 'Artist B',
        artistGuarantee: 2000,
        city: 'Paris',
        country: 'FR',
        capacity: 300,
        productionBudget: 8000,
      });

      expect(a.id).not.toBe(b.id);
    });

    it('persists the event via the repository', async () => {
      await service.createEvent({
        artistId: 'artist-001',
        artistName: 'Saved Artist',
        artistGuarantee: 3000,
        city: 'Tokyo',
        country: 'JP',
        capacity: 600,
        productionBudget: 15000,
      });

      expect(repo.save).toHaveBeenCalledOnce();
    });

    it('stores a domain event in memory', async () => {
      await service.createEvent({
        artistId: 'artist-001',
        artistName: 'Memory Artist',
        artistGuarantee: 3000,
        city: 'Sydney',
        country: 'AU',
        capacity: 400,
        productionBudget: 10000,
      });

      expect(memory.store).toHaveBeenCalledOnce();
      const [key, , namespace] = (memory.store as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(key).toMatch(/^event:.*:created$/);
      expect(namespace).toBe('smmn-events');
    });

    it('throws ZodError for missing required fields', async () => {
      await expect(
        service.createEvent({
          artistId: '',
          artistName: 'No ID',
          artistGuarantee: 1000,
          city: 'NYC',
          country: 'US',
          capacity: 100,
          productionBudget: 5000,
        })
      ).rejects.toThrow();
    });

    it('throws for negative artistGuarantee', async () => {
      await expect(
        service.createEvent({
          artistId: 'a',
          artistName: 'Bad Guarantee',
          artistGuarantee: -1000,
          city: 'NYC',
          country: 'US',
          capacity: 100,
          productionBudget: 5000,
        })
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getEvent
  // ---------------------------------------------------------------------------

  describe('getEvent', () => {
    it('returns an existing event', async () => {
      const existing = makeEvent({ id: 'test-evt-1' });
      repo = makeEventRepo([existing]);
      service = new EventService(repo, memory);

      const found = await service.getEvent('test-evt-1');
      expect(found?.id).toBe('test-evt-1');
    });

    it('returns null for unknown event ID', async () => {
      const result = await service.getEvent('unknown-id');
      expect(result).toBeNull();
    });

    it('throws for empty event ID', async () => {
      await expect(service.getEvent('')).rejects.toThrow('Event ID is required');
    });
  });

  // ---------------------------------------------------------------------------
  // updateEventStatus
  // ---------------------------------------------------------------------------

  describe('updateEventStatus', () => {
    it('transitions draft -> backer_round_open', async () => {
      const event = makeEvent({ id: 'evt-transition' });
      repo = makeEventRepo([event]);
      service = new EventService(repo, memory);

      const updated = await service.updateEventStatus('evt-transition', 'backer_round_open');
      expect(updated.status).toBe('backer_round_open');
    });

    it('rejects invalid transition draft -> completed', async () => {
      const event = makeEvent({ id: 'evt-invalid' });
      repo = makeEventRepo([event]);
      service = new EventService(repo, memory);

      await expect(
        service.updateEventStatus('evt-invalid', 'completed')
      ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
    });

    it('rejects transition from completed', async () => {
      const event = makeEvent({ id: 'evt-done', status: 'completed' });
      repo = makeEventRepo([event]);
      service = new EventService(repo, memory);

      await expect(
        service.updateEventStatus('evt-done', 'cancelled')
      ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
    });

    it('throws EventNotFoundError for unknown event', async () => {
      await expect(
        service.updateEventStatus('missing-evt', 'backer_round_open')
      ).rejects.toBeInstanceOf(EventNotFoundError);
    });

    it('emits a status_changed domain event', async () => {
      const event = makeEvent({ id: 'evt-emit' });
      repo = makeEventRepo([event]);
      service = new EventService(repo, memory);

      await service.updateEventStatus('evt-emit', 'backer_round_open');

      expect(memory.store).toHaveBeenCalledOnce();
      const [key, , namespace] = (memory.store as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(key).toMatch(/^event:evt-emit:status_changed/);
      expect(namespace).toBe('smmn-events');
    });
  });

  // ---------------------------------------------------------------------------
  // getEventAnalytics
  // ---------------------------------------------------------------------------

  describe('getEventAnalytics', () => {
    it('calculates analytics for an event with no revenue', async () => {
      const event = makeEvent({ id: 'evt-analytics' });
      repo = makeEventRepo([event]);
      service = new EventService(repo, memory);

      const analytics = await service.getEventAnalytics('evt-analytics');
      expect(analytics.eventId).toBe('evt-analytics');
      expect(analytics.totalRevenue).toBe(0);
      expect(analytics.grossProfit).toBe(-15000); // -(productionBudget + artistGuarantee)
    });

    it('calculates backer revenue from filled slots', async () => {
      const event = makeEvent({
        id: 'evt-backer-rev',
        backerRound: {
          eventId: 'evt-backer-rev',
          onChainAddress: 'addr',
          totalSlots: 10,
          filledSlots: 5,
          slotPrice: 1000,
          platformFee: 500,
          status: 'open',
          deadline: new Date('2030-01-01'),
          backers: [],
        },
      });
      repo = makeEventRepo([event]);
      service = new EventService(repo, memory);

      const analytics = await service.getEventAnalytics('evt-backer-rev');
      expect(analytics.backerRevenue).toBe(5000); // 5 slots * $1000
    });

    it('calculates paid sponsorship revenue', async () => {
      const event = makeEvent({
        id: 'evt-sponsor-rev',
        sponsorships: [
          { id: 's1', brandName: 'Brand A', amount: 2000, category: 'crypto', status: 'paid' },
          { id: 's2', brandName: 'Brand B', amount: 1000, category: 'apparel', status: 'pending' },
        ],
      });
      repo = makeEventRepo([event]);
      service = new EventService(repo, memory);

      const analytics = await service.getEventAnalytics('evt-sponsor-rev');
      expect(analytics.sponsorshipRevenue).toBe(2000); // only paid sponsorships
    });

    it('throws EventNotFoundError for unknown event', async () => {
      await expect(service.getEventAnalytics('ghost-evt')).rejects.toBeInstanceOf(
        EventNotFoundError
      );
    });
  });
});

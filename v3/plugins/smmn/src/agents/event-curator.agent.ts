/**
 * SMMN Event Curator Agent
 *
 * Scores artists and recommends events based on market data.
 * Assesses backer round viability and generates booking recommendations.
 *
 * Agent type: researcher
 *
 * @module v3/plugins/smmn/agents/event-curator.agent
 */

import type {
  Artist,
  SMMNEvent,
  ViabilityReport,
  EventAnalytics,
} from '../domain/types.js';
import type { IEventRepository, IArtistRepository } from '../domain/repositories.js';

// =============================================================================
// Types
// =============================================================================

export interface CurationConfig {
  minReputationScore: number;
  minFillRateThreshold: number;   // pct (0-100) fill rate considered viable
  maxGuaranteeToRevenueRatio: number; // guarantee / projected revenue cap
}

const DEFAULT_CONFIG: CurationConfig = {
  minReputationScore: 60,
  minFillRateThreshold: 70,
  maxGuaranteeToRevenueRatio: 0.5,
};

// =============================================================================
// Event Curator Agent
// =============================================================================

export class EventCuratorAgent {
  readonly type = 'researcher' as const;
  readonly name = 'smmn-event-curator';
  readonly capabilities = [
    'artist-scoring',
    'market-sizing',
    'event-recommendation',
    'viability-assessment',
  ];

  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly artistRepo: IArtistRepository,
    private readonly config: CurationConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Score an artist from 0-100 based on reputation, genre diversity,
   * event history, and engagement signals.
   */
  async scoreArtist(artist: Artist): Promise<number> {
    let score = artist.reputationScore;

    // Bonus for genre diversity
    if (artist.genre.length >= 2) score = Math.min(100, score + 5);

    // Bonus for social presence
    const socialHandleCount = Object.keys(artist.socialHandles ?? {}).length;
    if (socialHandleCount >= 3) score = Math.min(100, score + 5);

    // Bonus for proven event history
    if (artist.pastEvents.length >= 3) score = Math.min(100, score + 10);

    // Penalty for missing wallet (can't receive crypto payments)
    if (!artist.walletAddress) score = Math.max(0, score - 10);

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Recommend events in a city that fit within the given budget.
   * Returns events sorted by projected margin (descending).
   */
  async recommendEvents(city: string, budget: number): Promise<SMMNEvent[]> {
    const events = await this.eventRepo.findByCity(city);

    const eligible = events.filter((e) => {
      if (e.status === 'cancelled' || e.status === 'completed') return false;
      if (e.productionBudget + e.artistGuarantee > budget) return false;
      return true;
    });

    // Sort by projected margin heuristic: events with more tickets and lower guarantee first
    eligible.sort((a, b) => {
      const aRatio = a.artistGuarantee / (a.capacity * 50); // assume avg $50 ticket
      const bRatio = b.artistGuarantee / (b.capacity * 50);
      return aRatio - bRatio;
    });

    return eligible;
  }

  /**
   * Assess whether a backer round is viable for the given event.
   * Considers artist score, guarantee-to-revenue ratio, and market conditions.
   */
  async assessBackerRoundViability(event: SMMNEvent): Promise<ViabilityReport> {
    const artist = await this.artistRepo.findById(event.artistId);
    const artistScore = artist ? await this.scoreArtist(artist) : 50;

    const risks: string[] = [];
    const recommendations: string[] = [];

    // Check artist reputation
    if (artistScore < this.config.minReputationScore) {
      risks.push(`Artist reputation score (${artistScore}) below threshold (${this.config.minReputationScore})`);
      recommendations.push('Consider partnering with a higher-reputation artist or building their profile first');
    }

    // Check guarantee-to-revenue ratio
    const estimatedTicketRevenue = event.capacity * 50; // avg $50 ticket assumption
    const guaranteeRatio = event.artistGuarantee / estimatedTicketRevenue;
    if (guaranteeRatio > this.config.maxGuaranteeToRevenueRatio) {
      risks.push(
        `Artist guarantee ($${event.artistGuarantee}) is ${(guaranteeRatio * 100).toFixed(0)}% of estimated ticket revenue`
      );
      recommendations.push('Negotiate lower guarantee or increase ticket pricing');
    }

    // Estimate fill days based on slot price and artist appeal
    const estimatedFillDays = Math.ceil(
      (event.backerRound?.totalSlots ?? 50) / Math.max(1, artistScore / 10)
    );

    const score = Math.round(
      (artistScore * 0.5) +
      (guaranteeRatio < this.config.maxGuaranteeToRevenueRatio ? 30 : 0) +
      (risks.length === 0 ? 20 : 0)
    );

    const viable = score >= 60 && risks.length < 2;
    const confidence = Math.min(100, score);

    return {
      eventId: event.id,
      viable,
      confidence,
      risks,
      recommendations,
      estimatedFillDays,
    };
  }

  /**
   * Analyze past events for an artist and compute an average performance score.
   */
  async analyzeArtistPerformance(artistId: string): Promise<{
    averageMargin: number;
    totalEvents: number;
    successRate: number;
  }> {
    const events = await this.eventRepo.findByArtist(artistId);
    const completed = events.filter((e) => e.status === 'completed');

    if (completed.length === 0) {
      return { averageMargin: 0, totalEvents: events.length, successRate: 0 };
    }

    // Heuristic: completed events with filled backer rounds are successes
    const successes = completed.filter(
      (e) => e.backerRound?.status === 'finalized'
    ).length;

    const successRate = (successes / completed.length) * 100;

    // Average margin based on known event data
    const avgMargin = completed.reduce((sum, e) => {
      const revenue =
        (e.backerRound?.filledSlots ?? 0) * (e.backerRound?.slotPrice ?? 0) +
        e.sponsorships.filter((s) => s.status === 'paid').reduce((a, s) => a + s.amount, 0);
      const cost = e.productionBudget + e.artistGuarantee;
      if (revenue === 0) return sum;
      return sum + ((revenue - cost) / revenue) * 100;
    }, 0) / completed.length;

    return {
      averageMargin: Math.round(avgMargin * 100) / 100,
      totalEvents: events.length,
      successRate: Math.round(successRate * 100) / 100,
    };
  }
}

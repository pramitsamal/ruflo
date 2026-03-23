/**
 * SMMN Backer Coordinator Agent
 *
 * Monitors active backer rounds for fill rate, generates alerts when rounds
 * are falling behind, and suggests marketing actions to accelerate fills.
 *
 * Agent type: coordinator
 *
 * @module v3/plugins/smmn/agents/backer-coordinator.agent
 */

import type { SMMNEvent, RoundStatus } from '../domain/types.js';
import type { IEventRepository } from '../domain/repositories.js';

// =============================================================================
// Types
// =============================================================================

export interface CoordinatorAlert {
  eventId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  fillPct: number;
  daysRemaining: number;
  recommendedActions: string[];
  createdAt: Date;
}

// =============================================================================
// Backer Coordinator Agent
// =============================================================================

export class BackerCoordinatorAgent {
  readonly type = 'coordinator' as const;
  readonly name = 'smmn-backer-coordinator';
  readonly capabilities = [
    'round-monitoring',
    'fill-rate-analysis',
    'marketing-recommendations',
    'alert-generation',
  ];

  constructor(private readonly eventRepo: IEventRepository) {}

  /**
   * Get the current fill status for a backer round.
   * Returns fill percentage, days remaining, and projected fill date.
   */
  async monitorRound(eventId: string): Promise<RoundStatus> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    if (!event.backerRound) {
      throw new Error(`No backer round for event ${eventId}`);
    }

    const round = event.backerRound;
    const now = new Date();
    const msRemaining = round.deadline.getTime() - now.getTime();
    const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24));
    const fillPct = round.totalSlots > 0
      ? (round.filledSlots / round.totalSlots) * 100
      : 0;

    const totalDays = (round.deadline.getTime() - event.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = totalDays - daysRemaining;
    const fillRatePerDay = elapsedDays > 0
      ? round.filledSlots / elapsedDays
      : 0;

    let projectedFillDate: Date | null = null;
    const slotsLeft = round.totalSlots - round.filledSlots;
    if (fillRatePerDay > 0 && slotsLeft > 0) {
      const daysToFill = slotsLeft / fillRatePerDay;
      projectedFillDate = new Date(now.getTime() + daysToFill * 24 * 60 * 60 * 1000);
    }

    const isOnTrack = projectedFillDate
      ? projectedFillDate <= round.deadline
      : fillPct >= 50 && daysRemaining > 7;

    return {
      eventId,
      filledPct: Math.round(fillPct * 100) / 100,
      daysRemaining: Math.round(daysRemaining * 10) / 10,
      fillRatePerDay: Math.round(fillRatePerDay * 100) / 100,
      projectedFillDate,
      isOnTrack,
    };
  }

  /**
   * Generate an alert if fill rate falls below the threshold percentage.
   * Returns null if the round is on track.
   */
  async alertSlowFill(
    eventId: string,
    thresholdPct: number
  ): Promise<CoordinatorAlert | null> {
    const status = await this.monitorRound(eventId);

    if (status.fillPct >= thresholdPct) return null;

    const severity: CoordinatorAlert['severity'] =
      status.fillPct < thresholdPct * 0.5
        ? 'critical'
        : status.daysRemaining < 7
        ? 'warning'
        : 'info';

    const actions = await this.suggestMarketingActions(status.fillPct);

    return {
      eventId,
      severity,
      message:
        `Backer round is ${status.fillPct.toFixed(1)}% filled ` +
        `(threshold: ${thresholdPct}%) with ${status.daysRemaining.toFixed(1)} days remaining.`,
      fillPct: status.fillPct,
      daysRemaining: status.daysRemaining,
      recommendedActions: actions,
      createdAt: new Date(),
    };
  }

  /**
   * Generate context-appropriate marketing actions based on current fill rate.
   */
  async suggestMarketingActions(fillRate: number): Promise<string[]> {
    const actions: string[] = [];

    if (fillRate < 20) {
      actions.push('Launch targeted social media campaign featuring artist announcement');
      actions.push('Activate crypto influencer network with referral codes');
      actions.push('Send exclusive whitelist invites to top stakers (Gold tier first)');
      actions.push('Consider reducing slot price by 10% to boost early momentum');
    } else if (fillRate < 50) {
      actions.push('Share artist teaser content (snippets, behind-the-scenes)');
      actions.push('Activate email campaign to Silver+ tier holders');
      actions.push('Partner with local crypto communities in event city');
      actions.push('Create urgency messaging: "X slots remaining"');
    } else if (fillRate < 80) {
      actions.push('Push FOMO content: "Only X VVIP slots left"');
      actions.push('Highlight perks: meet & greet, backstage access');
      actions.push('Share existing backer testimonials and photos');
    } else {
      actions.push('Create waitlist for cancelled slots');
      actions.push('Notify waitlisted users immediately when slots open');
      actions.push('Consider launching a secondary market for NFT slot transfers');
    }

    return actions;
  }

  /**
   * Monitor all active backer rounds and return status for each.
   */
  async monitorAllRounds(): Promise<RoundStatus[]> {
    const events = await this.eventRepo.findByStatus('backer_round_open');
    const statuses: RoundStatus[] = [];

    for (const event of events) {
      try {
        const status = await this.monitorRound(event.id);
        statuses.push(status);
      } catch {
        // Skip events with monitoring errors
      }
    }

    return statuses.sort((a, b) => a.fillPct - b.fillPct); // worst first
  }

  /**
   * Summarize the health of all active rounds for a dashboard view.
   */
  async getRoundsHealthSummary(): Promise<{
    totalActive: number;
    onTrack: number;
    atRisk: number;
    critical: number;
  }> {
    const statuses = await this.monitorAllRounds();

    return {
      totalActive: statuses.length,
      onTrack: statuses.filter((s) => s.isOnTrack).length,
      atRisk: statuses.filter((s) => !s.isOnTrack && s.fillPct >= 30).length,
      critical: statuses.filter((s) => !s.isOnTrack && s.fillPct < 30).length,
    };
  }
}

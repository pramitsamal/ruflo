/**
 * SMMN Revenue Optimizer Agent
 *
 * Analyzes event data to optimize ticket pricing, project profitability,
 * and identify sponsorship opportunities.
 *
 * Agent type: planner
 *
 * @module v3/plugins/smmn/agents/revenue-optimizer.agent
 */

import type {
  SMMNEvent,
  TicketTier,
  SponsorshipDeal,
  ProfitabilityProjection,
} from '../domain/types.js';
import type { IEventRepository } from '../domain/repositories.js';

// =============================================================================
// Types
// =============================================================================

export interface TicketPricingRecommendation {
  tiers: TicketTier[];
  projectedRevenue: number;
  rationale: string;
}

export interface SponsorshipOpportunity {
  category: string;
  estimatedValue: number;
  approachStrategy: string;
  priority: 'high' | 'medium' | 'low';
}

// =============================================================================
// Revenue Optimizer Agent
// =============================================================================

export class RevenueOptimizerAgent {
  readonly type = 'planner' as const;
  readonly name = 'smmn-revenue-optimizer';
  readonly capabilities = [
    'ticket-pricing',
    'profitability-projection',
    'sponsorship-identification',
    'revenue-optimization',
  ];

  constructor(private readonly eventRepo: IEventRepository) {}

  /**
   * Generate optimized ticket tier pricing for an event.
   * Uses capacity, city tier, and production budget to suggest pricing.
   */
  async optimizeTicketPricing(
    event: SMMNEvent
  ): Promise<TicketPricingRecommendation> {
    const cityMultiplier = this.getCityMultiplier(event.city);
    const costBase = event.productionBudget + event.artistGuarantee;

    // GA: price to cover costs with 60% capacity at GA tier
    const gaPrice = Math.round((costBase / (event.capacity * 0.6)) * cityMultiplier);
    const vipPrice = Math.round(gaPrice * 2.5);
    const premiumPrice = Math.round(gaPrice * 5);

    const gaQuantity = Math.floor(event.capacity * 0.7);
    const vipQuantity = Math.floor(event.capacity * 0.2);
    const premiumQuantity = Math.floor(event.capacity * 0.1);

    const tiers: TicketTier[] = [
      { name: 'GA', price: gaPrice, quantity: gaQuantity, sold: 0 },
      { name: 'VIP', price: vipPrice, quantity: vipQuantity, sold: 0 },
      { name: 'Premium', price: premiumPrice, quantity: premiumQuantity, sold: 0 },
    ];

    const projectedRevenue =
      gaQuantity * gaPrice * 0.85 +     // 85% sell-through for GA
      vipQuantity * vipPrice * 0.7 +     // 70% for VIP
      premiumQuantity * premiumPrice * 0.5; // 50% for Premium

    return {
      tiers,
      projectedRevenue: Math.round(projectedRevenue),
      rationale:
        `Based on ${event.capacity} capacity at ${event.city} (${cityMultiplier}x multiplier). ` +
        `GA pricing set to recover costs at 60% sellthrough. ` +
        `VIP at 2.5x and Premium at 5x GA to maximize yield.`,
    };
  }

  /**
   * Project event profitability across pessimistic, base, and optimistic scenarios.
   */
  async projectProfitability(event: SMMNEvent): Promise<ProfitabilityProjection> {
    const backerRevenue = event.backerRound
      ? event.backerRound.totalSlots * event.backerRound.slotPrice
      : 0;

    const sponsorshipRevenue = event.sponsorships
      .filter((s) => s.status !== 'pending')
      .reduce((sum, s) => sum + s.amount, 0);

    const ticketRec = await this.optimizeTicketPricing(event);
    const baseCosts = event.productionBudget + event.artistGuarantee;

    const pessimisticRevenue =
      backerRevenue * 0.5 +
      sponsorshipRevenue * 0.8 +
      ticketRec.projectedRevenue * 0.6;

    const baseRevenue =
      backerRevenue +
      sponsorshipRevenue +
      ticketRec.projectedRevenue;

    const optimisticRevenue =
      backerRevenue * 1.1 +
      sponsorshipRevenue * 1.2 +
      ticketRec.projectedRevenue * 1.3;

    return {
      eventId: event.id,
      projectedRevenue: Math.round(baseRevenue),
      projectedCosts: baseCosts,
      projectedMargin: baseRevenue > 0
        ? Math.round(((baseRevenue - baseCosts) / baseRevenue) * 10000) / 100
        : 0,
      scenarios: {
        pessimistic: Math.round(pessimisticRevenue - baseCosts),
        base: Math.round(baseRevenue - baseCosts),
        optimistic: Math.round(optimisticRevenue - baseCosts),
      },
    };
  }

  /**
   * Identify sponsorship opportunities appropriate for the event genre and city.
   * Returns deals sorted by estimated value.
   */
  async identifySponsorshipOpportunities(
    event: SMMNEvent
  ): Promise<SponsorshipDeal[]> {
    const opportunities = this.getSponsorshipOpportunities(event);

    return opportunities.map((opp, i) => ({
      id: `opp_${event.id}_${i}`,
      brandName: `[${opp.category} Brand]`,
      amount: opp.estimatedValue,
      category: opp.category,
      status: 'pending' as const,
    }));
  }

  /**
   * Calculate break-even revenue needed for an event to be profitable.
   */
  async calculateBreakEven(event: SMMNEvent): Promise<{
    breakEvenRevenue: number;
    backerSlotsNeeded: number;
    ticketsSoldNeeded: number;
  }> {
    const breakEvenRevenue = event.productionBudget + event.artistGuarantee;
    const slotPrice = event.backerRound?.slotPrice ?? 500;
    const avgTicketPrice = 50;

    const backerSlotsNeeded = Math.ceil(
      breakEvenRevenue * 0.4 / slotPrice
    );
    const ticketsSoldNeeded = Math.ceil(
      breakEvenRevenue * 0.6 / avgTicketPrice
    );

    return {
      breakEvenRevenue,
      backerSlotsNeeded,
      ticketsSoldNeeded,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getCityMultiplier(city: string): number {
    const tier1 = ['New York', 'Los Angeles', 'London', 'Tokyo', 'Singapore', 'Dubai'];
    const tier2 = ['Chicago', 'Miami', 'Berlin', 'Paris', 'Sydney', 'Toronto'];

    const normalized = city.toLowerCase();
    if (tier1.some((c) => normalized.includes(c.toLowerCase()))) return 1.5;
    if (tier2.some((c) => normalized.includes(c.toLowerCase()))) return 1.2;
    return 1.0;
  }

  private getSponsorshipOpportunities(event: SMMNEvent): SponsorshipOpportunity[] {
    const budget = event.productionBudget;

    const opportunities: SponsorshipOpportunity[] = [
      {
        category: 'crypto',
        estimatedValue: Math.round(budget * 0.15),
        approachStrategy: 'Target L1/L2 chains and DeFi protocols for venue branding',
        priority: 'high',
      },
      {
        category: 'beverage',
        estimatedValue: Math.round(budget * 0.1),
        approachStrategy: 'Approach premium spirits and energy drink brands for bar sponsorship',
        priority: 'high',
      },
      {
        category: 'apparel',
        estimatedValue: Math.round(budget * 0.08),
        approachStrategy: 'Partner with streetwear brands for merchandise co-creation',
        priority: 'medium',
      },
      {
        category: 'technology',
        estimatedValue: Math.round(budget * 0.12),
        approachStrategy: 'Approach consumer tech brands for stage tech integration',
        priority: 'medium',
      },
      {
        category: 'media',
        estimatedValue: Math.round(budget * 0.07),
        approachStrategy: 'Partner with streaming platforms for exclusive live stream rights',
        priority: 'low',
      },
    ];

    return opportunities
      .filter((o) => o.estimatedValue > 0)
      .sort((a, b) => b.estimatedValue - a.estimatedValue);
  }
}

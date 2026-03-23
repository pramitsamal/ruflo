/**
 * SMMN MCP Tools
 *
 * 9 MCP tool definitions for the SMMN platform:
 * 1. smmn:create_event          — Create a new live event
 * 2. smmn:launch_backer_round   — Deploy on-chain backer round
 * 3. smmn:purchase_backer_slot  — Purchase slot + mint VVIP NFT
 * 4. smmn:finalize_backer_round — Release artist fees
 * 5. smmn:record_revenue        — Log revenue entry
 * 6. smmn:distribute_profits    — Execute profit waterfall
 * 7. smmn:stake_summon          — Stake $SUMMON tokens
 * 8. smmn:check_tier            — Get staking tier for wallet
 * 9. smmn:get_event_analytics   — P&L report for an event
 *
 * @module v3/plugins/smmn/api/mcp-tools
 */

import type { EventService } from '../application/event.service.js';
import type { BackerRoundService } from '../application/backer-round.service.js';
import type { RevenueService } from '../application/revenue.service.js';
import type { StakingService } from '../application/staking.service.js';
import type { RevenueSource } from '../domain/types.js';

// =============================================================================
// Tool Types (minimal, compatible with @modelcontextprotocol/sdk)
// =============================================================================

interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: string[];
  description?: string;
  minimum?: number;
  maximum?: number;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// =============================================================================
// Services Container
// =============================================================================

export interface SMMNServices {
  eventService: EventService;
  backerRoundService: BackerRoundService;
  revenueService: RevenueService;
  stakingService: StakingService;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const smmnMcpTools: Tool[] = [
  {
    name: 'smmn:create_event',
    description: 'Create a new SMMN live event with artist guarantee and production budget.',
    inputSchema: {
      type: 'object',
      properties: {
        artistId: { type: 'string', description: 'Artist identifier' },
        artistName: { type: 'string', description: 'Artist display name' },
        artistGuarantee: {
          type: 'number',
          description: 'Artist guaranteed fee in USD',
          minimum: 0,
        },
        city: { type: 'string', description: 'Event city' },
        country: { type: 'string', description: 'Event country (ISO code)' },
        capacity: {
          type: 'number',
          description: 'Venue capacity (number of tickets)',
          minimum: 1,
        },
        productionBudget: {
          type: 'number',
          description: 'Total production budget in USD',
          minimum: 0,
        },
        venue: { type: 'string', description: 'Venue name (optional)' },
      },
      required: ['artistId', 'artistName', 'artistGuarantee', 'city', 'country', 'capacity', 'productionBudget'],
    },
  },
  {
    name: 'smmn:launch_backer_round',
    description: 'Deploy an on-chain backer round for a draft event. Opens backer slot purchases.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID' },
        totalSlots: {
          type: 'number',
          description: 'Number of VVIP backer slots (max 500)',
          minimum: 1,
          maximum: 500,
        },
        slotPrice: {
          type: 'number',
          description: 'Price per slot in USD',
          minimum: 1,
        },
        deadlineIso: {
          type: 'string',
          description: 'Round closing deadline as ISO 8601 date string',
        },
      },
      required: ['eventId', 'totalSlots', 'slotPrice', 'deadlineIso'],
    },
  },
  {
    name: 'smmn:purchase_backer_slot',
    description: 'Purchase a VVIP backer slot and mint a VVIP NFT to the wallet address.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID' },
        walletAddress: {
          type: 'string',
          description: 'Solana wallet address (base58) of the backer',
        },
      },
      required: ['eventId', 'walletAddress'],
    },
  },
  {
    name: 'smmn:finalize_backer_round',
    description: 'Finalize the backer round: release artist fees on-chain and advance event to in_production.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'smmn:record_revenue',
    description: 'Record a revenue entry for an event (ticket sales, sponsorship, merchandise, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID' },
        amount: { type: 'number', description: 'Revenue amount in USD', minimum: 0.01 },
        source: {
          type: 'string',
          enum: ['backer', 'sponsorship', 'ticket', 'merchandise'],
          description: 'Revenue source category',
        },
        description: {
          type: 'string',
          description: 'Optional description or reference',
        },
      },
      required: ['eventId', 'amount', 'source'],
    },
  },
  {
    name: 'smmn:distribute_profits',
    description: 'Execute the profit waterfall distribution for a completed event (20% buyback, 30% staking, 50% SMMN).',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID (must be in completed status)' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'smmn:stake_summon',
    description: 'Stake $SUMMON tokens to access tier-based event benefits (bronze/silver/gold).',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Solana wallet address (base58)',
        },
        amount: {
          type: 'string',
          description: 'Amount of $SUMMON to stake in base units (6 decimals). E.g. "1000000000" = 1,000 SUMMON',
        },
      },
      required: ['walletAddress', 'amount'],
    },
  },
  {
    name: 'smmn:check_tier',
    description: 'Get the current staking tier (none/bronze/silver/gold) for a wallet address.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Solana wallet address (base58)',
        },
      },
      required: ['walletAddress'],
    },
  },
  {
    name: 'smmn:get_event_analytics',
    description: 'Get the P&L analytics report for an event including revenue breakdown and margin.',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID' },
      },
      required: ['eventId'],
    },
  },
];

// =============================================================================
// Tool Handler
// =============================================================================

/**
 * Dispatch an MCP tool call to the appropriate service method.
 */
export async function handleSmmnTool(
  name: string,
  args: Record<string, unknown>,
  services: SMMNServices
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'smmn:create_event': {
        const event = await services.eventService.createEvent({
          artistId: String(args.artistId),
          artistName: String(args.artistName),
          artistGuarantee: Number(args.artistGuarantee),
          city: String(args.city),
          country: String(args.country),
          capacity: Number(args.capacity),
          productionBudget: Number(args.productionBudget),
          venue: args.venue ? String(args.venue) : undefined,
        });
        return ok(`Event created: ${event.id}\nArtist: ${event.artistName}\nCity: ${event.city}\nStatus: ${event.status}`);
      }

      case 'smmn:launch_backer_round': {
        const round = await services.backerRoundService.launchBackerRound(
          String(args.eventId),
          {
            totalSlots: Number(args.totalSlots),
            slotPrice: Number(args.slotPrice),
            deadline: new Date(String(args.deadlineIso)),
          }
        );
        return ok(
          `Backer round launched for event ${args.eventId}\n` +
          `Slots: ${round.totalSlots} @ $${round.slotPrice}/slot\n` +
          `On-chain address: ${round.onChainAddress}\n` +
          `Deadline: ${round.deadline.toISOString()}`
        );
      }

      case 'smmn:purchase_backer_slot': {
        const slot = await services.backerRoundService.purchaseSlot(
          String(args.eventId),
          String(args.walletAddress)
        );
        return ok(
          `Slot #${slot.slotIndex} purchased successfully\n` +
          `Backer ID: ${slot.backerId}\n` +
          `NFT Mint: ${slot.nftMintAddress}\n` +
          `Paid: $${slot.paidAmount}`
        );
      }

      case 'smmn:finalize_backer_round': {
        const txSig = await services.backerRoundService.finalizeRound(
          String(args.eventId)
        );
        return ok(
          `Backer round finalized for event ${args.eventId}\n` +
          `Artist fees released. Tx: ${txSig}`
        );
      }

      case 'smmn:record_revenue': {
        await services.revenueService.recordRevenue(
          String(args.eventId),
          Number(args.amount),
          String(args.source) as RevenueSource,
          args.description ? String(args.description) : undefined
        );
        return ok(
          `Revenue recorded: $${args.amount} (${args.source}) for event ${args.eventId}`
        );
      }

      case 'smmn:distribute_profits': {
        const result = await services.revenueService.distributeProfit(
          String(args.eventId)
        );
        const wf = result.waterfall;
        return ok(
          `Profit distribution complete for event ${args.eventId}\n` +
          `Total revenue: $${wf.totalRevenue.toFixed(2)}\n` +
          `Net after costs: $${wf.netAfterCosts.toFixed(2)}\n` +
          `Buyback (20%): $${wf.buybackAllocation.toFixed(2)}\n` +
          `Staking (30%): $${wf.stakingAllocation.toFixed(2)}\n` +
          `SMMN (50%): $${wf.smmnAllocation.toFixed(2)}\n` +
          `Tx: ${result.txSignature}`
        );
      }

      case 'smmn:stake_summon': {
        const position = await services.stakingService.stake(
          String(args.walletAddress),
          BigInt(String(args.amount))
        );
        return ok(
          `Staked successfully\nWallet: ${position.walletAddress}\n` +
          `Total staked: ${position.amountStaked.toString()} base units\n` +
          `Tier: ${position.tier}`
        );
      }

      case 'smmn:check_tier': {
        const tier = await services.stakingService.getStakingTier(
          String(args.walletAddress)
        );
        return ok(`Staking tier for ${args.walletAddress}: ${tier}`);
      }

      case 'smmn:get_event_analytics': {
        const analytics = await services.eventService.getEventAnalytics(
          String(args.eventId)
        );
        return ok(
          `Event Analytics: ${args.eventId}\n` +
          `Artist Guarantee: $${analytics.artistGuarantee.toFixed(2)}\n` +
          `Production Budget: $${analytics.productionBudget.toFixed(2)}\n` +
          `Backer Revenue: $${analytics.backerRevenue.toFixed(2)}\n` +
          `Sponsorship Revenue: $${analytics.sponsorshipRevenue.toFixed(2)}\n` +
          `Ticket Revenue: $${analytics.ticketRevenue.toFixed(2)}\n` +
          `Total Revenue: $${analytics.totalRevenue.toFixed(2)}\n` +
          `Gross Profit: $${analytics.grossProfit.toFixed(2)}\n` +
          `SMMN Share: $${analytics.smmnShare.toFixed(2)}\n` +
          `Margin: ${analytics.margin.toFixed(2)}%`
        );
      }

      default:
        return error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return error(err instanceof Error ? err.message : String(err));
  }
}

// =============================================================================
// Helper Factories
// =============================================================================

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function error(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true };
}

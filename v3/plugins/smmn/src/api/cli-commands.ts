// @ts-nocheck - CLI integration requires the full @claude-flow/cli package
/**
 * SMMN CLI Commands
 *
 * CLI command definitions for the `smmn` subcommand group.
 * Follows the patterns established in @claude-flow/claims/src/api/cli-commands.ts
 *
 * Command groups:
 * - smmn event [create|list|status]
 * - smmn backer [purchase|list]
 * - smmn token [stake|unstake|tier]
 * - smmn analytics <eventId>
 *
 * @module v3/plugins/smmn/api/cli-commands
 */

// =============================================================================
// CLI Types (lightweight, matching v3 CLI interface)
// =============================================================================

export interface CliOption {
  name: string;
  alias?: string;
  type?: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface CliSubcommand {
  name: string;
  description: string;
  args?: string[];
  options?: CliOption[];
  subcommands?: CliSubcommand[];
}

export interface CliCommandGroup {
  name: string;
  description: string;
  subcommands: CliSubcommand[];
}

// =============================================================================
// SMMN Command Definitions
// =============================================================================

export const smmnCommands: CliCommandGroup = {
  name: 'smmn',
  description: 'SMMN platform management — live events, backer rounds, and $SUMMON staking',
  subcommands: [
    // -------------------------------------------------------------------------
    // smmn event
    // -------------------------------------------------------------------------
    {
      name: 'event',
      description: 'Manage SMMN live events',
      subcommands: [
        {
          name: 'create',
          description: 'Create a new SMMN live event',
          options: [
            {
              name: 'artist-id',
              alias: 'a',
              type: 'string',
              description: 'Artist identifier',
              required: true,
            },
            {
              name: 'artist-name',
              alias: 'n',
              type: 'string',
              description: 'Artist display name',
              required: true,
            },
            {
              name: 'guarantee',
              alias: 'g',
              type: 'number',
              description: 'Artist guarantee in USD',
              required: true,
            },
            {
              name: 'city',
              alias: 'c',
              type: 'string',
              description: 'Event city',
              required: true,
            },
            {
              name: 'country',
              type: 'string',
              description: 'Country (ISO code, e.g. US)',
              required: true,
            },
            {
              name: 'capacity',
              type: 'number',
              description: 'Venue capacity',
              required: true,
            },
            {
              name: 'budget',
              alias: 'b',
              type: 'number',
              description: 'Production budget in USD',
              required: true,
            },
            {
              name: 'venue',
              alias: 'v',
              type: 'string',
              description: 'Venue name (optional)',
              required: false,
            },
            {
              name: 'date',
              alias: 'd',
              type: 'string',
              description: 'Event date as ISO 8601 string (optional)',
              required: false,
            },
          ],
        },
        {
          name: 'list',
          description: 'List all SMMN events',
          options: [
            {
              name: 'status',
              alias: 's',
              type: 'string',
              description: 'Filter by status (draft|backer_round_open|in_production|completed|cancelled)',
              required: false,
            },
            {
              name: 'city',
              alias: 'c',
              type: 'string',
              description: 'Filter by city',
              required: false,
            },
            {
              name: 'json',
              type: 'boolean',
              description: 'Output as JSON',
              required: false,
              default: false,
            },
          ],
        },
        {
          name: 'status',
          description: 'Get event status and financial summary',
          args: ['<eventId>'],
          options: [
            {
              name: 'json',
              type: 'boolean',
              description: 'Output as JSON',
              required: false,
              default: false,
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // smmn backer
    // -------------------------------------------------------------------------
    {
      name: 'backer',
      description: 'Manage backer rounds and slot purchases',
      subcommands: [
        {
          name: 'launch',
          description: 'Launch a backer round for a draft event',
          args: ['<eventId>'],
          options: [
            {
              name: 'slots',
              alias: 's',
              type: 'number',
              description: 'Number of VVIP backer slots (1-500)',
              required: true,
            },
            {
              name: 'price',
              alias: 'p',
              type: 'number',
              description: 'Slot price in USD',
              required: true,
            },
            {
              name: 'deadline',
              alias: 'd',
              type: 'string',
              description: 'Round closing deadline (ISO 8601)',
              required: true,
            },
          ],
        },
        {
          name: 'purchase',
          description: 'Purchase a VVIP backer slot and receive an NFT',
          args: ['<eventId>'],
          options: [
            {
              name: 'wallet',
              alias: 'w',
              type: 'string',
              description: 'Solana wallet address (base58)',
              required: true,
            },
          ],
        },
        {
          name: 'list',
          description: 'List all backers for an event',
          args: ['<eventId>'],
          options: [
            {
              name: 'json',
              type: 'boolean',
              description: 'Output as JSON',
              default: false,
            },
          ],
        },
        {
          name: 'finalize',
          description: 'Finalize the backer round and release artist fees',
          args: ['<eventId>'],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // smmn token
    // -------------------------------------------------------------------------
    {
      name: 'token',
      description: 'Manage $SUMMON token staking',
      subcommands: [
        {
          name: 'stake',
          description: 'Stake $SUMMON tokens to access tier benefits',
          options: [
            {
              name: 'wallet',
              alias: 'w',
              type: 'string',
              description: 'Solana wallet address (base58)',
              required: true,
            },
            {
              name: 'amount',
              alias: 'a',
              type: 'string',
              description: 'Amount in base units (6 decimals). E.g. "1000000000" = 1,000 SUMMON',
              required: true,
            },
          ],
        },
        {
          name: 'unstake',
          description: 'Unstake $SUMMON tokens',
          options: [
            {
              name: 'wallet',
              alias: 'w',
              type: 'string',
              description: 'Solana wallet address (base58)',
              required: true,
            },
            {
              name: 'amount',
              alias: 'a',
              type: 'string',
              description: 'Amount in base units to unstake',
              required: true,
            },
          ],
        },
        {
          name: 'tier',
          description: 'Show current staking tier for a wallet',
          options: [
            {
              name: 'wallet',
              alias: 'w',
              type: 'string',
              description: 'Solana wallet address (base58)',
              required: true,
            },
          ],
        },
        {
          name: 'claim-yield',
          description: 'Claim pending staking yield',
          options: [
            {
              name: 'wallet',
              alias: 'w',
              type: 'string',
              description: 'Solana wallet address (base58)',
              required: true,
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // smmn revenue
    // -------------------------------------------------------------------------
    {
      name: 'revenue',
      description: 'Track and distribute event revenue',
      subcommands: [
        {
          name: 'record',
          description: 'Record a revenue entry for an event',
          args: ['<eventId>'],
          options: [
            {
              name: 'amount',
              alias: 'a',
              type: 'number',
              description: 'Revenue amount in USD',
              required: true,
            },
            {
              name: 'source',
              alias: 's',
              type: 'string',
              description: 'Source: backer|sponsorship|ticket|merchandise',
              required: true,
            },
            {
              name: 'description',
              alias: 'd',
              type: 'string',
              description: 'Optional description or reference',
            },
          ],
        },
        {
          name: 'distribute',
          description: 'Execute profit waterfall distribution for a completed event',
          args: ['<eventId>'],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // smmn analytics
    // -------------------------------------------------------------------------
    {
      name: 'analytics',
      description: 'Get P&L analytics report for an event',
      args: ['<eventId>'],
      options: [
        {
          name: 'json',
          type: 'boolean',
          description: 'Output as JSON',
          default: false,
        },
      ],
    },
  ],
};

// =============================================================================
// Command Description Helper
// =============================================================================

/**
 * Return a flat list of all SMMN CLI commands for registration with the
 * @claude-flow/cli command registry.
 */
export function getSMmnCommandDescriptions(): Array<{
  path: string;
  description: string;
}> {
  const results: Array<{ path: string; description: string }> = [];

  function flatten(cmds: CliSubcommand[], prefix: string): void {
    for (const cmd of cmds) {
      const path = `${prefix} ${cmd.name}`.trim();
      results.push({ path, description: cmd.description });
      if (cmd.subcommands) {
        flatten(cmd.subcommands, path);
      }
    }
  }

  flatten(smmnCommands.subcommands, smmnCommands.name);
  return results;
}

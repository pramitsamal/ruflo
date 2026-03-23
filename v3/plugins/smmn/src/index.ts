/**
 * SMMN Plugin — Main Entry Point
 *
 * @claude-flow/plugin-smmn v0.1.0
 * Solana-based live events co-creation platform integration for claude-flow.
 *
 * @module v3/plugins/smmn
 */

// Domain layer
export * from './domain/types.js';
export * from './domain/events.js';
export * from './domain/repositories.js';

// Application services
export * from './application/event.service.js';
export * from './application/backer-round.service.js';
export * from './application/revenue.service.js';
export * from './application/staking.service.js';

// Infrastructure
export * from './infrastructure/solana-client.js';
export * from './infrastructure/anchor-programs.js';
export * from './infrastructure/metaplex-nft.js';
export * from './infrastructure/spl-token.js';

// API layer
export * from './api/mcp-tools.js';
export * from './api/cli-commands.js';

// Agents
export * from './agents/event-curator.agent.js';
export * from './agents/backer-coordinator.agent.js';
export * from './agents/revenue-optimizer.agent.js';

// Plugin metadata
export const SMMN_VERSION = '0.1.0';
export const PLUGIN_NAME = '@claude-flow/plugin-smmn';

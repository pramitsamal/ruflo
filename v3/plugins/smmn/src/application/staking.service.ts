/**
 * SMMN Staking Service
 *
 * $SUMMON token staking management with tier-based benefits.
 * Tiers unlock priority access, guaranteed backer slots, and VVIP experiences.
 *
 * Tier thresholds (base units, 6 decimals):
 * - Bronze: 1,000 SUMMON = 1_000_000_000 base units
 * - Silver: 5,000 SUMMON = 5_000_000_000 base units
 * - Gold:  25,000 SUMMON = 25_000_000_000 base units
 *
 * @module v3/plugins/smmn/application/staking.service
 */

import { z } from 'zod';
import type {
  StakingPosition,
  StakingTierLevel,
  SMMNConfig,
} from '../domain/types.js';
import { STAKING_TIERS } from '../domain/types.js';
import {
  createTokensStakedEvent,
  createTokensUnstakedEvent,
} from '../domain/events.js';
import { walletAddressSchema } from '../infrastructure/solana-client.js';

// =============================================================================
// Validation
// =============================================================================

const StakeSchema = z.object({
  walletAddress: walletAddressSchema,
  amount: z.bigint().positive(),
});

// =============================================================================
// Error Types
// =============================================================================

export class StakingServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StakingServiceError';
  }
}

export class InsufficientStakeError extends StakingServiceError {
  constructor(requested: bigint, available: bigint) {
    super(`Cannot unstake ${requested}: only ${available} staked`);
    this.name = 'InsufficientStakeError';
  }
}

// =============================================================================
// In-Memory Staking Store (replace with on-chain reads in production)
// =============================================================================

const stakingPositions = new Map<string, StakingPosition>();
let totalStaked = 0n;

// =============================================================================
// Dependency Interfaces
// =============================================================================

interface MemoryService {
  store(key: string, value: unknown, namespace?: string): Promise<void>;
}

interface TokenService {
  getTokenBalance(walletAddress: string, mintAddress: string): Promise<bigint>;
}

// =============================================================================
// Staking Service
// =============================================================================

export class StakingService {
  constructor(
    private readonly memory: MemoryService,
    private readonly tokenService: TokenService,
    private readonly config: Pick<SMMNConfig, 'programs'>
  ) {}

  /**
   * Stake $SUMMON tokens for the given wallet.
   * Returns the updated staking position after staking.
   */
  async stake(walletAddress: string, amount: bigint): Promise<StakingPosition> {
    StakeSchema.parse({ walletAddress, amount });

    const existing = stakingPositions.get(walletAddress);
    const currentStaked = existing?.amountStaked ?? 0n;
    const newTotal = currentStaked + amount;
    const tier = this.computeTier(newTotal);

    const position: StakingPosition = {
      walletAddress,
      amountStaked: newTotal,
      tier,
      stakedAt: existing?.stakedAt ?? new Date(),
      pendingYield: existing?.pendingYield ?? 0n,
    };

    stakingPositions.set(walletAddress, position);
    totalStaked += amount;

    // In production: call Anchor staking program
    const txSignature = `stake_${walletAddress.slice(0, 8)}_${Date.now()}`;

    // Emit domain event
    const domainEvent = createTokensStakedEvent(position, txSignature);
    await this.memory.store(
      `staking:${walletAddress}:staked:${Date.now()}`,
      domainEvent,
      'smmn-events'
    );

    return position;
  }

  /**
   * Unstake $SUMMON tokens for the given wallet.
   * Returns the updated staking position after unstaking.
   */
  async unstake(walletAddress: string, amount: bigint): Promise<StakingPosition> {
    StakeSchema.parse({ walletAddress, amount });

    const existing = stakingPositions.get(walletAddress);
    if (!existing || existing.amountStaked === 0n) {
      throw new StakingServiceError(`No staking position found for ${walletAddress}`);
    }
    if (amount > existing.amountStaked) {
      throw new InsufficientStakeError(amount, existing.amountStaked);
    }

    const newTotal = existing.amountStaked - amount;
    const tier = this.computeTier(newTotal);

    const position: StakingPosition = {
      ...existing,
      amountStaked: newTotal,
      tier,
    };

    stakingPositions.set(walletAddress, position);
    totalStaked -= amount;

    // In production: call Anchor staking program
    const txSignature = `unstake_${walletAddress.slice(0, 8)}_${Date.now()}`;

    // Emit domain event
    const domainEvent = createTokensUnstakedEvent(
      walletAddress,
      amount,
      newTotal,
      tier,
      txSignature
    );
    await this.memory.store(
      `staking:${walletAddress}:unstaked:${Date.now()}`,
      domainEvent,
      'smmn-events'
    );

    return position;
  }

  /**
   * Get the current staking tier for a wallet address.
   */
  async getStakingTier(walletAddress: string): Promise<StakingTierLevel> {
    walletAddressSchema.parse(walletAddress);
    const position = stakingPositions.get(walletAddress);
    if (!position) return 'none';
    return position.tier;
  }

  /**
   * Claim accumulated staking yield.
   * Returns the amount of yield claimed in base units.
   */
  async claimYield(walletAddress: string): Promise<bigint> {
    walletAddressSchema.parse(walletAddress);

    const position = stakingPositions.get(walletAddress);
    if (!position) {
      throw new StakingServiceError(`No staking position found for ${walletAddress}`);
    }

    const yield_ = position.pendingYield;
    if (yield_ === 0n) {
      throw new StakingServiceError('No pending yield to claim');
    }

    // In production: call Anchor staking program's claimYield
    stakingPositions.set(walletAddress, { ...position, pendingYield: 0n });

    return yield_;
  }

  /**
   * Get the total amount of $SUMMON currently staked across all wallets.
   */
  async getTotalStaked(): Promise<bigint> {
    return totalStaked;
  }

  /**
   * Get the staking position for a wallet, or null if none exists.
   */
  async getPosition(walletAddress: string): Promise<StakingPosition | null> {
    walletAddressSchema.parse(walletAddress);
    return stakingPositions.get(walletAddress) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private computeTier(amountStaked: bigint): StakingTierLevel {
    if (amountStaked >= STAKING_TIERS.gold.threshold) return 'gold';
    if (amountStaked >= STAKING_TIERS.silver.threshold) return 'silver';
    if (amountStaked >= STAKING_TIERS.bronze.threshold) return 'bronze';
    return 'none';
  }
}

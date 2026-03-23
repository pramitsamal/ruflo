/**
 * SMMN Solana Client
 *
 * Wraps @solana/web3.js Connection with retry logic, input validation,
 * and health-check capabilities for the SMMN platform.
 *
 * @module v3/plugins/smmn/infrastructure/solana-client
 */

import {
  Connection,
  PublicKey,
  Transaction,
  Signer,
  sendAndConfirmTransaction as solanaSendAndConfirm,
  LAMPORTS_PER_SOL,
  Commitment,
} from '@solana/web3.js';
import { z } from 'zod';

// =============================================================================
// Validation Schemas
// =============================================================================

/** Solana base58 address — 32-44 chars, no 0/O/I/l */
export const walletAddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana base58 address');

// =============================================================================
// Retry Configuration
// =============================================================================

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[SolanaClient] ${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms`, err);
        await sleep(delay);
      }
    }
  }
  throw new SolanaClientError(`${operationName} failed after ${MAX_RETRIES + 1} attempts`, lastError);
}

// =============================================================================
// Error Types
// =============================================================================

export class SolanaClientError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SolanaClientError';
  }
}

export class InvalidAddressError extends SolanaClientError {
  constructor(address: string) {
    super(`Invalid Solana address: ${address}`);
    this.name = 'InvalidAddressError';
  }
}

// =============================================================================
// Client Options
// =============================================================================

export interface SolanaClientOptions {
  rpcUrl: string;
  commitment?: Commitment;
}

// =============================================================================
// Solana Client
// =============================================================================

/**
 * Thin, retry-aware wrapper around @solana/web3.js Connection.
 * All public methods validate inputs and retry on transient failures.
 */
export class SolanaClient {
  private readonly connection: Connection;
  private readonly commitment: Commitment;

  constructor(options: SolanaClientOptions) {
    this.commitment = options.commitment ?? 'confirmed';
    this.connection = new Connection(options.rpcUrl, this.commitment);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the underlying Connection for use with Anchor or Metaplex.
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get SOL balance in lamports for a wallet address.
   */
  async getBalance(walletAddress: string): Promise<number> {
    this.validateAddress(walletAddress);
    const pubkey = new PublicKey(walletAddress);
    return withRetry(
      () => this.connection.getBalance(pubkey, this.commitment),
      `getBalance(${walletAddress})`
    );
  }

  /**
   * Get SOL balance as a decimal number (lamports / LAMPORTS_PER_SOL).
   */
  async getSolBalance(walletAddress: string): Promise<number> {
    const lamports = await this.getBalance(walletAddress);
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Get SPL token balance in base units for a specific mint.
   */
  async getTokenBalance(walletAddress: string, mintAddress: string): Promise<bigint> {
    this.validateAddress(walletAddress);
    this.validateAddress(mintAddress);

    const ownerPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(mintAddress);

    const response = await withRetry(
      () =>
        this.connection.getParsedTokenAccountsByOwner(ownerPubkey, {
          mint: mintPubkey,
        }),
      `getTokenBalance(${walletAddress}, ${mintAddress})`
    );

    if (response.value.length === 0) {
      return 0n;
    }

    const tokenAmount = response.value[0].account.data.parsed.info.tokenAmount;
    return BigInt(tokenAmount.amount);
  }

  /**
   * Sign and submit a transaction, waiting for confirmation.
   * Returns the transaction signature.
   */
  async sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Signer[]
  ): Promise<string> {
    return withRetry(
      () =>
        solanaSendAndConfirm(this.connection, transaction, signers, {
          commitment: this.commitment,
        }),
      'sendAndConfirmTransaction'
    );
  }

  /**
   * Confirm a transaction by signature.
   */
  async confirmTransaction(signature: string): Promise<boolean> {
    const result = await withRetry(
      () => this.connection.confirmTransaction(signature, this.commitment),
      `confirmTransaction(${signature})`
    );
    return result.value.err === null;
  }

  /**
   * Health check: verifies RPC connection is alive.
   * Returns true if healthy.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.connection.getSlot();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current block height.
   */
  async getBlockHeight(): Promise<number> {
    return withRetry(
      () => this.connection.getBlockHeight(this.commitment),
      'getBlockHeight'
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private validateAddress(address: string): void {
    const result = walletAddressSchema.safeParse(address);
    if (!result.success) {
      throw new InvalidAddressError(address);
    }
  }
}

/**
 * Factory helper — creates a SolanaClient from a SMMNConfig.
 */
export function createSolanaClient(rpcUrl: string, commitment?: Commitment): SolanaClient {
  return new SolanaClient({ rpcUrl, commitment });
}

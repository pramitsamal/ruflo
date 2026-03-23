/**
 * SMMN SPL Token Service
 *
 * $SUMMON token operations using @solana/spl-token.
 * Handles token balance queries, transfers, and associated token accounts.
 *
 * @module v3/plugins/smmn/infrastructure/spl-token
 */

import {
  Connection,
  PublicKey,
  Keypair,
  type Signer,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getOrCreateAssociatedTokenAccount,
  transfer as splTransfer,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { walletAddressSchema } from './solana-client.js';

// =============================================================================
// Error Types
// =============================================================================

export class SplTokenError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SplTokenError';
  }
}

// =============================================================================
// Token Balance
// =============================================================================

/**
 * Get the SPL token balance in base units for a wallet.
 * Returns 0n if no associated token account exists.
 */
export async function getTokenBalance(
  connection: Connection,
  walletAddress: string,
  mintAddress: string
): Promise<bigint> {
  walletAddressSchema.parse(walletAddress);
  walletAddressSchema.parse(mintAddress);

  try {
    const ownerPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(mintAddress);

    const ata = await getAssociatedTokenAddress(
      mintPubkey,
      ownerPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const accountInfo = await getAccount(connection, ata);
    return accountInfo.amount;
  } catch (err) {
    // TokenAccountNotFoundError is common when balance is zero
    const errorMessage = String(err);
    if (
      errorMessage.includes('TokenAccountNotFoundError') ||
      errorMessage.includes('could not find account')
    ) {
      return 0n;
    }
    throw new SplTokenError(
      `Failed to get token balance for ${walletAddress}`,
      err
    );
  }
}

// =============================================================================
// Token Transfer
// =============================================================================

/**
 * Transfer SPL tokens from one wallet to another.
 * Both wallets must have existing associated token accounts for the mint.
 * Returns the transaction signature.
 */
export async function transferTokens(
  connection: Connection,
  fromWallet: string,
  toWallet: string,
  amount: bigint,
  mintAddress: string,
  payer: Signer
): Promise<string> {
  walletAddressSchema.parse(fromWallet);
  walletAddressSchema.parse(toWallet);
  walletAddressSchema.parse(mintAddress);

  if (amount <= 0n) {
    throw new SplTokenError('Transfer amount must be greater than zero');
  }

  try {
    const fromPubkey = new PublicKey(fromWallet);
    const toPubkey = new PublicKey(toWallet);
    const mintPubkey = new PublicKey(mintAddress);

    const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    const signature = await splTransfer(
      connection,
      payer,
      fromAta,
      toAta,
      fromPubkey,
      amount
    );

    return signature;
  } catch (err) {
    throw new SplTokenError(
      `Failed to transfer ${amount} tokens from ${fromWallet} to ${toWallet}`,
      err
    );
  }
}

// =============================================================================
// Associated Token Account
// =============================================================================

/**
 * Get or create an associated token account for the owner/mint pair.
 * Returns the associated token account's public key.
 */
export async function createAssociatedTokenAccount(
  connection: Connection,
  owner: string,
  mintAddress: string,
  payer: Signer
): Promise<string> {
  walletAddressSchema.parse(owner);
  walletAddressSchema.parse(mintAddress);

  try {
    const ownerPubkey = new PublicKey(owner);
    const mintPubkey = new PublicKey(mintAddress);

    const account = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mintPubkey,
      ownerPubkey
    );

    return account.address.toBase58();
  } catch (err) {
    throw new SplTokenError(
      `Failed to get/create associated token account for ${owner}`,
      err
    );
  }
}

/**
 * Derive the associated token account address without creating it.
 * This is a pure computation (no RPC call required).
 */
export async function deriveAssociatedTokenAddress(
  owner: string,
  mintAddress: string
): Promise<string> {
  walletAddressSchema.parse(owner);
  walletAddressSchema.parse(mintAddress);

  const ownerPubkey = new PublicKey(owner);
  const mintPubkey = new PublicKey(mintAddress);

  const ata = await getAssociatedTokenAddress(
    mintPubkey,
    ownerPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return ata.toBase58();
}

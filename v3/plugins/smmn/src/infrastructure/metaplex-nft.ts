/**
 * SMMN Metaplex NFT Service
 *
 * Mints VVIP NFTs for backer round participants using
 * @metaplex-foundation/umi + mpl-token-metadata.
 *
 * Each NFT represents a backer slot with VVIP access rights.
 *
 * @module v3/plugins/smmn/infrastructure/metaplex-nft
 */

import type { Connection } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey as umiPublicKey,
  type Umi,
  type KeypairSigner,
} from '@metaplex-foundation/umi';
import {
  createNft,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';

// =============================================================================
// Types
// =============================================================================

export interface MintVVIPNftConfig {
  /** Recipient wallet address (base58) */
  recipient: string;
  /** SMMN event ID for this NFT */
  eventId: string;
  /** Human-readable event/artist name */
  eventName: string;
  /** Slot index (1-based) within the backer round */
  slotIndex: number;
  /** URI to NFT metadata JSON (IPFS or Arweave) */
  metadataUri: string;
  /** Payer/authority keypair signer */
  payer: KeypairSigner;
}

export interface MintedNft {
  /** Base58 mint address of the newly created NFT */
  mintAddress: string;
  /** Transaction signature */
  txSignature: string;
}

export class MetaplexNftError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'MetaplexNftError';
  }
}

// =============================================================================
// NFT Attribute Helpers
// =============================================================================

function buildNftAttributes(
  eventId: string,
  eventName: string,
  slotIndex: number
): Array<{ trait_type: string; value: string | number }> {
  return [
    { trait_type: 'Event ID', value: eventId },
    { trait_type: 'Event Name', value: eventName },
    { trait_type: 'Slot Index', value: slotIndex },
    { trait_type: 'Tier', value: 'VVIP' },
    { trait_type: 'Access Rights', value: 'Backstage + Meet & Greet' },
    { trait_type: 'Platform', value: 'SMMN' },
  ];
}

// =============================================================================
// NFT Minting
// =============================================================================

/**
 * Initialize a UMI instance bound to the given Solana RPC.
 */
export function createMetaplexUmi(rpcUrl: string, payer: KeypairSigner): Umi {
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());
  umi.use(keypairIdentity(payer));
  return umi;
}

/**
 * Mint a VVIP NFT for a backer slot purchase.
 *
 * Creates a non-fungible token with:
 * - Metadata pointing to the provided URI
 * - Attributes: event ID, slot index, VVIP tier, access rights
 * - 0% seller fee (secondary sales not monetized by platform)
 *
 * @returns Mint address and transaction signature
 */
export async function mintVVIPNft(
  rpcUrl: string,
  config: MintVVIPNftConfig
): Promise<MintedNft> {
  try {
    const umi = createMetaplexUmi(rpcUrl, config.payer);

    // Generate a new keypair for the NFT mint account
    const mintSigner = generateSigner(umi);

    const nftName = `SMMN VVIP #${config.slotIndex} - ${config.eventName}`;
    const nftSymbol = 'SMMN';

    const { signature } = await createNft(umi, {
      mint: mintSigner,
      name: nftName,
      symbol: nftSymbol,
      uri: config.metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      tokenOwner: umiPublicKey(config.recipient),
      tokenStandard: TokenStandard.NonFungible,
      isMutable: false,
    }).sendAndConfirm(umi);

    return {
      mintAddress: mintSigner.publicKey.toString(),
      txSignature: Buffer.from(signature).toString('base64'),
    };
  } catch (err) {
    throw new MetaplexNftError(
      `Failed to mint VVIP NFT for event ${config.eventId} slot ${config.slotIndex}`,
      err
    );
  }
}

/**
 * Build the off-chain metadata JSON for a VVIP NFT.
 * This should be uploaded to IPFS/Arweave before minting.
 */
export function buildVVIPNftMetadata(
  eventId: string,
  eventName: string,
  slotIndex: number,
  imageUri: string,
  artistName: string
): Record<string, unknown> {
  return {
    name: `SMMN VVIP #${slotIndex} - ${eventName}`,
    symbol: 'SMMN',
    description: `VVIP backer slot #${slotIndex} for "${eventName}" by ${artistName}. Grants backstage access, meet & greet, and revenue sharing rights.`,
    image: imageUri,
    external_url: `https://smmn.io/events/${eventId}`,
    attributes: buildNftAttributes(eventId, eventName, slotIndex),
    properties: {
      files: [{ uri: imageUri, type: 'image/png' }],
      category: 'image',
    },
  };
}

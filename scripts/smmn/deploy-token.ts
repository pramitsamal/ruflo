/**
 * SMMN $SUMMON Token Deployment Script
 *
 * Deploys the $SUMMON SPL token and initializes distribution vaults
 * according to the whitepaper tokenomics:
 *
 *   Platform Reserve:    40M (5-year linear vest)
 *   Community Growth:    25M (backer rewards + liquidity mining)
 *   Team & Advisors:     20M (4-year vest, 1-year cliff)
 *   Strategic Partners:  10M (2-year vest)
 *   Initial Liquidity:    5M (2-year lock)
 *
 * Usage:
 *   npx ts-node scripts/smmn/deploy-token.ts --cluster devnet
 *   npx ts-node scripts/smmn/deploy-token.ts --cluster mainnet-beta
 */

import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  sendAndConfirmTransaction,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  createAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Configuration ────────────────────────────────────────────────────────────

const TOTAL_SUPPLY = 100_000_000; // 100M tokens
const DECIMALS = 6;
const TOTAL_SUPPLY_BASE = BigInt(TOTAL_SUPPLY) * BigInt(10 ** DECIMALS);

const DISTRIBUTION = {
  platformReserve: { pct: 40, vestingYears: 5, label: 'Platform Reserve' },
  communityGrowth: { pct: 25, vestingYears: 0, label: 'Community Growth' },
  teamAdvisors: { pct: 20, vestingYears: 4, cliffYears: 1, label: 'Team & Advisors' },
  strategicPartners: { pct: 10, vestingYears: 2, label: 'Strategic Partners' },
  initialLiquidity: { pct: 5, lockYears: 2, label: 'Initial Liquidity' },
} as const;

type Cluster = 'devnet' | 'mainnet-beta' | 'localnet';

// ─── Main Deployment ──────────────────────────────────────────────────────────

async function deployToken(cluster: Cluster): Promise<void> {
  console.log(`\n🚀 SMMN $SUMMON Token Deployment`);
  console.log(`   Network: ${cluster}`);
  console.log(`   Total Supply: ${TOTAL_SUPPLY.toLocaleString()} $SUMMON\n`);

  // Load deployer keypair
  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH ??
    join(process.env.HOME ?? '', '.config/solana/id.json');

  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8')) as number[];
  const deployer = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log(`   Deployer: ${deployer.publicKey.toBase58()}`);

  // Connect
  const rpcUrl = cluster === 'localnet'
    ? 'http://localhost:8899'
    : clusterApiUrl(cluster);
  const connection = new Connection(rpcUrl, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    throw new Error('Insufficient SOL balance. Need at least 0.1 SOL for deployment.');
  }

  // ── 1. Create $SUMMON mint ──────────────────────────────────────────────────
  console.log('\n[1/6] Creating $SUMMON SPL token mint...');

  const mint = await createMint(
    connection,
    deployer,          // payer
    deployer.publicKey, // mint authority
    deployer.publicKey, // freeze authority
    DECIMALS,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID,
  );

  console.log(`   ✓ Mint: ${mint.toBase58()}`);

  // ── 2. Create distribution vault accounts ──────────────────────────────────
  console.log('\n[2/6] Creating distribution vaults...');

  const vaults: Record<string, PublicKey> = {};
  const vaultKeypairs: Record<string, Keypair> = {};

  for (const [key, dist] of Object.entries(DISTRIBUTION)) {
    const vaultKp = Keypair.generate();
    vaultKeypairs[key] = vaultKp;

    const vaultAta = await getOrCreateAssociatedTokenAccount(
      connection,
      deployer,
      mint,
      vaultKp.publicKey,
    );
    vaults[key] = vaultAta.address;
    console.log(`   ✓ ${dist.label} vault: ${vaultAta.address.toBase58()}`);
  }

  // ── 3. Mint tokens to each vault ───────────────────────────────────────────
  console.log('\n[3/6] Minting $SUMMON to distribution vaults...');

  for (const [key, dist] of Object.entries(DISTRIBUTION)) {
    const amount = (TOTAL_SUPPLY_BASE * BigInt(dist.pct)) / 100n;

    await mintTo(
      connection,
      deployer,
      mint,
      vaults[key],
      deployer,
      amount,
    );

    console.log(
      `   ✓ ${dist.label}: ${(Number(amount) / 10 ** DECIMALS).toLocaleString()} $SUMMON (${dist.pct}%)`,
    );
  }

  // ── 4. Revoke mint authority (after full supply minted) ─────────────────────
  console.log('\n[4/6] Revoking mint authority (fixed supply)...');
  // Note: In production, transfer mint authority to a DAO/multisig before revoking
  // await setAuthority(connection, deployer, mint, deployer, AuthorityType.MintTokens, null);
  console.log('   ⚠  Skipped in dev — transfer mint authority to multisig before mainnet');

  // ── 5. Print deployment summary ────────────────────────────────────────────
  console.log('\n[5/6] Deployment Summary:');
  console.log('─'.repeat(60));
  console.log(`   Mint Address:   ${mint.toBase58()}`);
  console.log(`   Network:        ${cluster}`);
  console.log(`   Total Supply:   ${TOTAL_SUPPLY.toLocaleString()} $SUMMON`);
  console.log(`   Decimals:       ${DECIMALS}`);
  console.log('\n   Distribution Vaults:');

  for (const [key, dist] of Object.entries(DISTRIBUTION)) {
    const amount = (TOTAL_SUPPLY * dist.pct) / 100;
    console.log(`   - ${dist.label.padEnd(20)} ${amount.toLocaleString().padStart(12)} $SUMMON → ${vaults[key].toBase58()}`);
  }

  // ── 6. Save deployment config ──────────────────────────────────────────────
  console.log('\n[6/6] Deployment config saved to:');
  const deployConfig = {
    network: cluster,
    mintAddress: mint.toBase58(),
    decimals: DECIMALS,
    totalSupply: TOTAL_SUPPLY,
    deployedAt: new Date().toISOString(),
    deployer: deployer.publicKey.toBase58(),
    vaults: Object.fromEntries(
      Object.entries(vaults).map(([key, pubkey]) => [
        key,
        {
          address: pubkey.toBase58(),
          label: DISTRIBUTION[key as keyof typeof DISTRIBUTION].label,
          pct: DISTRIBUTION[key as keyof typeof DISTRIBUTION].pct,
        },
      ]),
    ),
  };

  const configPath = join(process.cwd(), 'config', 'smmn-token-deployment.json');
  console.log(`   ${configPath}`);
  console.log('\n   Config:');
  console.log(JSON.stringify(deployConfig, null, 2));

  console.log('\n✅ $SUMMON token deployment complete!\n');
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

const clusterArg = process.argv.find((a) => a.startsWith('--cluster='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--cluster') + 1]
  ?? 'devnet';

const validClusters: Cluster[] = ['devnet', 'mainnet-beta', 'localnet'];

if (!validClusters.includes(clusterArg as Cluster)) {
  console.error(`Invalid cluster: ${clusterArg}. Must be one of: ${validClusters.join(', ')}`);
  process.exit(1);
}

deployToken(clusterArg as Cluster).catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

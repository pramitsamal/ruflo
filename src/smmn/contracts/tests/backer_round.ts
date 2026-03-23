import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BackerRound } from "../target/types/backer_round";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";

const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

function findMetadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function findMasterEditionPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  )[0];
}

describe("backer_round", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BackerRound as Program<BackerRound>;

  // Actors
  const artist = Keypair.generate();
  const backer = Keypair.generate();

  // Round parameters
  const ARTIST_FEE = new anchor.BN(2 * LAMPORTS_PER_SOL); // 2 SOL total
  const TOTAL_SLOTS = 2;
  const METADATA_URI = "https://arweave.net/smmn-vvip-metadata.json";

  // PDAs
  let backerRoundPda: PublicKey;
  let backerRoundBump: number;
  let escrowPda: PublicKey;
  let escrowBump: number;
  let backerSlotPda: PublicKey;

  const nftMintKeypair = Keypair.generate();

  before(async () => {
    // Airdrop SOL to artist and backer
    await Promise.all([
      provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(artist.publicKey, 5 * LAMPORTS_PER_SOL)
      ),
      provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(backer.publicKey, 5 * LAMPORTS_PER_SOL)
      ),
    ]);

    // Derive PDAs
    [backerRoundPda, backerRoundBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("backer_round"), artist.publicKey.toBuffer()],
      program.programId
    );

    [escrowPda, escrowBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), backerRoundPda.toBuffer()],
      program.programId
    );

    [backerSlotPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("backer_slot"),
        backerRoundPda.toBuffer(),
        Buffer.from(new Uint32Array([0]).buffer), // slot_index = 0 in LE
      ],
      program.programId
    );
  });

  it("initializes a backer round", async () => {
    await program.methods
      .initializeRound(ARTIST_FEE, TOTAL_SLOTS, METADATA_URI)
      .accounts({
        artist: artist.publicKey,
        backerRound: backerRoundPda,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([artist])
      .rpc();

    const roundAccount = await program.account.backerRound.fetch(backerRoundPda);

    assert.ok(roundAccount.artist.equals(artist.publicKey), "artist matches");
    assert.equal(
      roundAccount.artistFee.toString(),
      ARTIST_FEE.toString(),
      "artist fee matches"
    );
    assert.equal(roundAccount.totalSlots, TOTAL_SLOTS, "total slots matches");
    assert.equal(roundAccount.filledSlots, 0, "filled slots is zero");
    assert.equal(
      roundAccount.pricePerSlot.toString(),
      ARTIST_FEE.divn(TOTAL_SLOTS).toString(),
      "price per slot matches"
    );
    assert.equal(roundAccount.metadataUri, METADATA_URI, "metadata URI matches");
    assert.deepEqual(roundAccount.status, { open: {} }, "status is Open");

    console.log(
      `  Round initialized: ${backerRoundPda.toBase58()}`
    );
    console.log(
      `  Price per slot: ${roundAccount.pricePerSlot.toNumber() / LAMPORTS_PER_SOL} SOL`
    );
  });

  it("purchases a slot and mints a VVIP NFT", async () => {
    const slotIndex = 0;
    const backerTokenAccount = await getAssociatedTokenAddress(
      nftMintKeypair.publicKey,
      backer.publicKey
    );
    const metadataPda = findMetadataPda(nftMintKeypair.publicKey);
    const masterEditionPda = findMasterEditionPda(nftMintKeypair.publicKey);

    await program.methods
      .purchaseSlot(slotIndex)
      .accounts({
        backer: backer.publicKey,
        backerRound: backerRoundPda,
        escrow: escrowPda,
        backerSlot: backerSlotPda,
        nftMint: nftMintKeypair.publicKey,
        backerTokenAccount,
        metadata: metadataPda,
        masterEdition: masterEditionPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([backer, nftMintKeypair])
      .rpc();

    // Verify slot account
    const slotAccount = await program.account.backerSlot.fetch(backerSlotPda);
    assert.ok(slotAccount.backer.equals(backer.publicKey), "backer matches");
    assert.ok(slotAccount.round.equals(backerRoundPda), "round matches");
    assert.equal(slotAccount.slotIndex, slotIndex, "slot index matches");
    assert.ok(
      slotAccount.nftMint.equals(nftMintKeypair.publicKey),
      "NFT mint matches"
    );

    // Verify round state updated
    const roundAccount = await program.account.backerRound.fetch(backerRoundPda);
    assert.equal(roundAccount.filledSlots, 1, "filled slots incremented");

    console.log(`  Slot 0 purchased by: ${backer.publicKey.toBase58()}`);
    console.log(`  VVIP NFT minted: ${nftMintKeypair.publicKey.toBase58()}`);
  });

  it("fills the round and finalizes to release escrow to artist", async () => {
    // Purchase the second slot to fill the round
    const backer2 = Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(backer2.publicKey, 5 * LAMPORTS_PER_SOL)
    );

    const nftMint2 = Keypair.generate();
    const [slotPda2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("backer_slot"),
        backerRoundPda.toBuffer(),
        Buffer.from(new Uint32Array([1]).buffer), // slot_index = 1
      ],
      program.programId
    );

    const backer2TokenAccount = await getAssociatedTokenAddress(
      nftMint2.publicKey,
      backer2.publicKey
    );
    const metadataPda2 = findMetadataPda(nftMint2.publicKey);
    const masterEditionPda2 = findMasterEditionPda(nftMint2.publicKey);

    await program.methods
      .purchaseSlot(1)
      .accounts({
        backer: backer2.publicKey,
        backerRound: backerRoundPda,
        escrow: escrowPda,
        backerSlot: slotPda2,
        nftMint: nftMint2.publicKey,
        backerTokenAccount: backer2TokenAccount,
        metadata: metadataPda2,
        masterEdition: masterEditionPda2,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([backer2, nftMint2])
      .rpc();

    // Verify round is Filled
    let roundAccount = await program.account.backerRound.fetch(backerRoundPda);
    assert.deepEqual(roundAccount.status, { filled: {} }, "status is Filled");
    assert.equal(roundAccount.filledSlots, TOTAL_SLOTS, "all slots filled");

    console.log(`  Round fully filled! Finalizing...`);

    // Record artist balance before finalization
    const artistBalanceBefore = await provider.connection.getBalance(artist.publicKey);

    // Finalize the round
    await program.methods
      .finalizeRound()
      .accounts({
        artist: artist.publicKey,
        backerRound: backerRoundPda,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([artist])
      .rpc();

    // Verify round is Finalized
    roundAccount = await program.account.backerRound.fetch(backerRoundPda);
    assert.deepEqual(roundAccount.status, { finalized: {} }, "status is Finalized");

    // Verify artist received funds
    const artistBalanceAfter = await provider.connection.getBalance(artist.publicKey);
    const received = artistBalanceAfter - artistBalanceBefore;

    assert.isAbove(received, 0, "artist received SOL from escrow");
    console.log(
      `  Artist received: ${received / LAMPORTS_PER_SOL} SOL`
    );
    console.log(`  Round finalized successfully.`);
  });
});

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

declare_id!("BackRndxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

pub const MAX_METADATA_URI_LEN: usize = 200;
pub const ROUND_SEED: &[u8] = b"backer_round";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const SLOT_SEED: &[u8] = b"backer_slot";

#[program]
pub mod backer_round {
    use super::*;

    /// Creates a new BackerRound account and associated escrow PDA.
    pub fn initialize_round(
        ctx: Context<InitializeRound>,
        artist_fee: u64,
        total_slots: u32,
        metadata_uri: String,
    ) -> Result<()> {
        require!(total_slots > 0, BackerRoundError::InvalidSlotCount);
        require!(
            metadata_uri.len() <= MAX_METADATA_URI_LEN,
            BackerRoundError::MetadataUriTooLong
        );
        require!(artist_fee > 0, BackerRoundError::InvalidArtistFee);

        let price_per_slot = artist_fee
            .checked_div(total_slots as u64)
            .ok_or(BackerRoundError::MathOverflow)?;

        let round = &mut ctx.accounts.backer_round;
        round.artist = ctx.accounts.artist.key();
        round.artist_fee = artist_fee;
        round.total_slots = total_slots;
        round.filled_slots = 0;
        round.price_per_slot = price_per_slot;
        round.metadata_uri = metadata_uri;
        round.status = RoundStatus::Open;
        round.escrow_bump = ctx.bumps.escrow;
        round.bump = ctx.bumps.backer_round;

        emit!(RoundInitialized {
            round: ctx.accounts.backer_round.key(),
            artist: ctx.accounts.artist.key(),
            artist_fee,
            total_slots,
            price_per_slot,
        });

        Ok(())
    }

    /// Backer purchases a slot: pays SOL into escrow and receives a VVIP NFT.
    pub fn purchase_slot(ctx: Context<PurchaseSlot>, slot_index: u32) -> Result<()> {
        let round = &ctx.accounts.backer_round;

        require!(round.status == RoundStatus::Open, BackerRoundError::RoundNotOpen);
        require!(
            slot_index < round.total_slots,
            BackerRoundError::InvalidSlotIndex
        );

        let price = round.price_per_slot;
        require!(
            ctx.accounts.backer.lamports() >= price,
            BackerRoundError::InsufficientPayment
        );

        // Transfer SOL from backer to escrow
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            ctx.accounts.backer.key,
            ctx.accounts.escrow.key,
            price,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.backer.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Mint VVIP NFT to backer
        let round_key = ctx.accounts.backer_round.key();
        let mint_seeds = &[
            ROUND_SEED,
            round_key.as_ref(),
            &[ctx.accounts.backer_round.bump],
        ];
        let signer_seeds = &[&mint_seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    to: ctx.accounts.backer_token_account.to_account_info(),
                    authority: ctx.accounts.backer_round.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // Create metadata
        let data = DataV2 {
            name: String::from("SMMN VVIP"),
            symbol: String::from("VVIP"),
            uri: ctx.accounts.backer_round.metadata_uri.clone(),
            seller_fee_basis_points: 500,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    mint_authority: ctx.accounts.backer_round.to_account_info(),
                    payer: ctx.accounts.backer.to_account_info(),
                    update_authority: ctx.accounts.backer_round.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            data,
            true,
            true,
            None,
        )?;

        create_master_edition_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    update_authority: ctx.accounts.backer_round.to_account_info(),
                    mint_authority: ctx.accounts.backer_round.to_account_info(),
                    payer: ctx.accounts.backer.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            Some(0), // max supply 0 = unlimited prints disabled (1-of-1)
        )?;

        // Record slot
        let slot = &mut ctx.accounts.backer_slot;
        slot.backer = ctx.accounts.backer.key();
        slot.round = ctx.accounts.backer_round.key();
        slot.slot_index = slot_index;
        slot.nft_mint = ctx.accounts.nft_mint.key();
        slot.purchased_at = Clock::get()?.unix_timestamp;
        slot.bump = ctx.bumps.backer_slot;

        // Update round state
        let round = &mut ctx.accounts.backer_round;
        round.filled_slots = round
            .filled_slots
            .checked_add(1)
            .ok_or(BackerRoundError::MathOverflow)?;

        if round.filled_slots == round.total_slots {
            round.status = RoundStatus::Filled;
        }

        emit!(SlotPurchased {
            round: round.key(),
            backer: ctx.accounts.backer.key(),
            slot_index,
            nft_mint: ctx.accounts.nft_mint.key(),
        });

        Ok(())
    }

    /// Releases escrowed funds to artist once all slots are filled.
    pub fn finalize_round(ctx: Context<FinalizeRound>) -> Result<()> {
        let round = &ctx.accounts.backer_round;

        require!(
            round.artist == ctx.accounts.artist.key(),
            BackerRoundError::UnauthorizedArtist
        );
        require!(
            round.status == RoundStatus::Filled,
            BackerRoundError::RoundNotFilled
        );

        let escrow_balance = ctx.accounts.escrow.lamports();
        let rent_exempt = Rent::get()?.minimum_balance(0);
        let transferable = escrow_balance
            .checked_sub(rent_exempt)
            .ok_or(BackerRoundError::MathOverflow)?;

        // Transfer from escrow PDA to artist using seeds
        let round_key = ctx.accounts.backer_round.key();
        let escrow_seeds = &[
            ESCROW_SEED,
            round_key.as_ref(),
            &[ctx.accounts.backer_round.escrow_bump],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.escrow.key,
                ctx.accounts.artist.key,
                transferable,
            ),
            &[
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.artist.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        let round = &mut ctx.accounts.backer_round;
        round.status = RoundStatus::Finalized;

        emit!(RoundFinalized {
            round: ctx.accounts.backer_round.key(),
            artist: ctx.accounts.artist.key(),
            amount: transferable,
        });

        Ok(())
    }

    /// Returns funds to a backer if the round is cancelled.
    pub fn cancel_round(ctx: Context<CancelRound>) -> Result<()> {
        let round = &ctx.accounts.backer_round;
        require!(
            round.artist == ctx.accounts.artist.key(),
            BackerRoundError::UnauthorizedArtist
        );
        require!(
            round.status == RoundStatus::Open || round.status == RoundStatus::Filled,
            BackerRoundError::RoundAlreadyFinalized
        );

        let round = &mut ctx.accounts.backer_round;
        round.status = RoundStatus::Cancelled;

        Ok(())
    }

    /// Refunds a single backer's slot payment when the round is cancelled.
    pub fn refund_backer(ctx: Context<RefundBacker>, _slot_index: u32) -> Result<()> {
        let round = &ctx.accounts.backer_round;
        require!(
            round.status == RoundStatus::Cancelled,
            BackerRoundError::RoundNotCancelled
        );

        let refund_amount = round.price_per_slot;
        let round_key = ctx.accounts.backer_round.key();
        let escrow_seeds = &[
            ESCROW_SEED,
            round_key.as_ref(),
            &[ctx.accounts.backer_round.escrow_bump],
        ];
        let signer_seeds = &[&escrow_seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.escrow.key,
                ctx.accounts.backer.key,
                refund_amount,
            ),
            &[
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.backer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        emit!(BackerRefunded {
            round: ctx.accounts.backer_round.key(),
            backer: ctx.accounts.backer.key(),
            amount: refund_amount,
        });

        Ok(())
    }
}

// ─── Account Structures ───────────────────────────────────────────────────────

#[account]
pub struct BackerRound {
    pub artist: Pubkey,         // 32
    pub artist_fee: u64,        // 8
    pub total_slots: u32,       // 4
    pub filled_slots: u32,      // 4
    pub price_per_slot: u64,    // 8
    pub metadata_uri: String,   // 4 + 200
    pub status: RoundStatus,    // 1
    pub escrow_bump: u8,        // 1
    pub bump: u8,               // 1
}

impl BackerRound {
    pub const LEN: usize = 8 + 32 + 8 + 4 + 4 + 8 + (4 + MAX_METADATA_URI_LEN) + 1 + 1 + 1;
}

#[account]
pub struct BackerSlot {
    pub backer: Pubkey,       // 32
    pub round: Pubkey,        // 32
    pub slot_index: u32,      // 4
    pub nft_mint: Pubkey,     // 32
    pub purchased_at: i64,    // 8
    pub bump: u8,             // 1
}

impl BackerSlot {
    pub const LEN: usize = 8 + 32 + 32 + 4 + 32 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RoundStatus {
    Open,
    Filled,
    Cancelled,
    Finalized,
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(artist_fee: u64, total_slots: u32, metadata_uri: String)]
pub struct InitializeRound<'info> {
    #[account(mut)]
    pub artist: Signer<'info>,

    #[account(
        init,
        payer = artist,
        space = BackerRound::LEN,
        seeds = [ROUND_SEED, artist.key().as_ref()],
        bump
    )]
    pub backer_round: Account<'info, BackerRound>,

    /// CHECK: PDA escrow account holding SOL — validated by seeds
    #[account(
        mut,
        seeds = [ESCROW_SEED, backer_round.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(slot_index: u32)]
pub struct PurchaseSlot<'info> {
    #[account(mut)]
    pub backer: Signer<'info>,

    #[account(
        mut,
        seeds = [ROUND_SEED, backer_round.artist.as_ref()],
        bump = backer_round.bump,
    )]
    pub backer_round: Account<'info, BackerRound>,

    /// CHECK: PDA escrow — validated by seeds
    #[account(
        mut,
        seeds = [ESCROW_SEED, backer_round.key().as_ref()],
        bump = backer_round.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    #[account(
        init,
        payer = backer,
        space = BackerSlot::LEN,
        seeds = [SLOT_SEED, backer_round.key().as_ref(), &slot_index.to_le_bytes()],
        bump
    )]
    pub backer_slot: Account<'info, BackerSlot>,

    #[account(
        init,
        payer = backer,
        mint::decimals = 0,
        mint::authority = backer_round,
        mint::freeze_authority = backer_round,
    )]
    pub nft_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = backer,
        associated_token::mint = nft_mint,
        associated_token::authority = backer,
    )]
    pub backer_token_account: Account<'info, TokenAccount>,

    /// CHECK: Metaplex metadata account — derived from mint
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Metaplex master edition account — derived from mint
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FinalizeRound<'info> {
    #[account(mut)]
    pub artist: Signer<'info>,

    #[account(
        mut,
        seeds = [ROUND_SEED, artist.key().as_ref()],
        bump = backer_round.bump,
        has_one = artist @ BackerRoundError::UnauthorizedArtist,
    )]
    pub backer_round: Account<'info, BackerRound>,

    /// CHECK: PDA escrow — validated by seeds
    #[account(
        mut,
        seeds = [ESCROW_SEED, backer_round.key().as_ref()],
        bump = backer_round.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelRound<'info> {
    #[account(mut)]
    pub artist: Signer<'info>,

    #[account(
        mut,
        seeds = [ROUND_SEED, artist.key().as_ref()],
        bump = backer_round.bump,
        has_one = artist @ BackerRoundError::UnauthorizedArtist,
    )]
    pub backer_round: Account<'info, BackerRound>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(slot_index: u32)]
pub struct RefundBacker<'info> {
    #[account(mut)]
    pub backer: Signer<'info>,

    #[account(
        mut,
        seeds = [ROUND_SEED, backer_round.artist.as_ref()],
        bump = backer_round.bump,
    )]
    pub backer_round: Account<'info, BackerRound>,

    /// CHECK: PDA escrow — validated by seeds
    #[account(
        mut,
        seeds = [ESCROW_SEED, backer_round.key().as_ref()],
        bump = backer_round.escrow_bump,
    )]
    pub escrow: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [SLOT_SEED, backer_round.key().as_ref(), &slot_index.to_le_bytes()],
        bump = backer_slot.bump,
        has_one = backer @ BackerRoundError::UnauthorizedBacker,
    )]
    pub backer_slot: Account<'info, BackerSlot>,

    pub system_program: Program<'info, System>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct RoundInitialized {
    pub round: Pubkey,
    pub artist: Pubkey,
    pub artist_fee: u64,
    pub total_slots: u32,
    pub price_per_slot: u64,
}

#[event]
pub struct SlotPurchased {
    pub round: Pubkey,
    pub backer: Pubkey,
    pub slot_index: u32,
    pub nft_mint: Pubkey,
}

#[event]
pub struct RoundFinalized {
    pub round: Pubkey,
    pub artist: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BackerRefunded {
    pub round: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum BackerRoundError {
    #[msg("The round is not open for purchases")]
    RoundNotOpen,
    #[msg("This slot has already been taken")]
    SlotAlreadyTaken,
    #[msg("Insufficient payment for slot purchase")]
    InsufficientPayment,
    #[msg("The round is not yet filled")]
    RoundNotFilled,
    #[msg("The round has already been finalized")]
    RoundAlreadyFinalized,
    #[msg("Only the artist can perform this action")]
    UnauthorizedArtist,
    #[msg("Only the backer can perform this action")]
    UnauthorizedBacker,
    #[msg("Metadata URI exceeds maximum length of 200 characters")]
    MetadataUriTooLong,
    #[msg("Invalid slot count: must be greater than zero")]
    InvalidSlotCount,
    #[msg("Invalid artist fee: must be greater than zero")]
    InvalidArtistFee,
    #[msg("Slot index out of range")]
    InvalidSlotIndex,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("The round is not cancelled")]
    RoundNotCancelled,
}

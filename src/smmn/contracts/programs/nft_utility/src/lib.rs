use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

declare_id!("NftUtlxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

pub const CONTENT_LOCK_SEED: &[u8] = b"content_lock";
pub const GOVERNANCE_VOTE_SEED: &[u8] = b"governance_vote";
pub const ROYALTY_CLAIM_SEED: &[u8] = b"royalty_claim";
pub const ROYALTY_VAULT_SEED: &[u8] = b"royalty_vault";

// Royalty rate: 2.5% in basis points
pub const ROYALTY_BPS: u16 = 250;
pub const TOTAL_BPS: u16 = 10_000;

#[program]
pub mod nft_utility {
    use super::*;

    /// Locks content behind a time-gate tied to a specific VVIP NFT mint.
    pub fn lock_content(
        ctx: Context<LockContent>,
        content_hash: [u8; 32],
        unlock_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(unlock_at > now, NftUtilityError::UnlockTimeInPast);

        let lock = &mut ctx.accounts.content_lock;
        lock.nft_mint = ctx.accounts.nft_mint.key();
        lock.content_hash = content_hash;
        lock.unlock_at = unlock_at;
        lock.is_unlocked = false;
        lock.creator = ctx.accounts.creator.key();
        lock.bump = ctx.bumps.content_lock;

        emit!(ContentLocked {
            nft_mint: ctx.accounts.nft_mint.key(),
            content_hash,
            unlock_at,
        });

        Ok(())
    }

    /// Unlocks content when the time-lock has expired.
    /// Any VVIP NFT holder can call this once the unlock time is reached.
    pub fn unlock_content(ctx: Context<UnlockContent>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let lock = &ctx.accounts.content_lock;

        require!(!lock.is_unlocked, NftUtilityError::AlreadyUnlocked);
        require!(now >= lock.unlock_at, NftUtilityError::ContentStillLocked);

        // Verify caller holds the NFT
        require!(
            ctx.accounts.holder_token_account.amount >= 1,
            NftUtilityError::NotNftHolder
        );

        ctx.accounts.content_lock.is_unlocked = true;

        emit!(ContentUnlocked {
            nft_mint: ctx.accounts.nft_mint.key(),
            content_hash: ctx.accounts.content_lock.content_hash,
            unlocked_by: ctx.accounts.holder.key(),
        });

        Ok(())
    }

    /// Casts a governance vote on a proposal. Requires holding the VVIP NFT.
    /// One NFT = one vote. Prevents double-voting via PDA uniqueness.
    pub fn cast_vote(
        ctx: Context<CastVote>,
        proposal_id: u64,
        vote: bool,
    ) -> Result<()> {
        require!(
            ctx.accounts.holder_token_account.amount >= 1,
            NftUtilityError::NotNftHolder
        );

        let governance_vote = &mut ctx.accounts.governance_vote;
        governance_vote.proposal_id = proposal_id;
        governance_vote.voter = ctx.accounts.holder.key();
        governance_vote.nft_mint = ctx.accounts.nft_mint.key();
        governance_vote.vote = vote;
        governance_vote.voted_at = Clock::get()?.unix_timestamp;
        governance_vote.bump = ctx.bumps.governance_vote;

        emit!(VoteCast {
            proposal_id,
            voter: ctx.accounts.holder.key(),
            nft_mint: ctx.accounts.nft_mint.key(),
            vote,
        });

        Ok(())
    }

    /// Deposits royalty funds into the vault for later claiming.
    pub fn deposit_royalty(ctx: Context<DepositRoyalty>, amount: u64) -> Result<()> {
        require!(amount > 0, NftUtilityError::ZeroAmount);

        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.depositor.key,
                ctx.accounts.royalty_vault.key,
                amount,
            ),
            &[
                ctx.accounts.depositor.to_account_info(),
                ctx.accounts.royalty_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        emit!(RoyaltyDeposited {
            nft_mint: ctx.accounts.nft_mint.key(),
            amount,
            depositor: ctx.accounts.depositor.key(),
        });

        Ok(())
    }

    /// Claims accrued royalties for a VVIP NFT holder.
    /// Emits the claim amount for off-chain settlement. Marks claim to prevent replay.
    pub fn claim_royalty(ctx: Context<ClaimRoyalty>, period_id: u64) -> Result<()> {
        require!(
            ctx.accounts.holder_token_account.amount >= 1,
            NftUtilityError::NotNftHolder
        );
        require!(
            !ctx.accounts.royalty_claim.is_claimed,
            NftUtilityError::AlreadyClaimed
        );

        let vault_balance = ctx.accounts.royalty_vault.lamports();
        let rent_exempt = Rent::get()?.minimum_balance(0);
        let claimable = vault_balance
            .checked_sub(rent_exempt)
            .ok_or(NftUtilityError::InsufficientVaultBalance)?;

        require!(claimable > 0, NftUtilityError::InsufficientVaultBalance);

        let nft_mint_key = ctx.accounts.nft_mint.key();
        let vault_seeds = &[
            ROYALTY_VAULT_SEED,
            nft_mint_key.as_ref(),
            &[ctx.bumps.royalty_vault],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.royalty_vault.key,
                ctx.accounts.holder.key,
                claimable,
            ),
            &[
                ctx.accounts.royalty_vault.to_account_info(),
                ctx.accounts.holder.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        ctx.accounts.royalty_claim.is_claimed = true;
        ctx.accounts.royalty_claim.claimed_at = Clock::get()?.unix_timestamp;
        ctx.accounts.royalty_claim.amount = claimable;

        emit!(RoyaltyClaimed {
            nft_mint: ctx.accounts.nft_mint.key(),
            holder: ctx.accounts.holder.key(),
            amount: claimable,
            period_id,
        });

        Ok(())
    }
}

// ─── Account Structures ───────────────────────────────────────────────────────

#[account]
pub struct ContentLock {
    pub nft_mint: Pubkey,         // 32
    pub content_hash: [u8; 32],   // 32
    pub unlock_at: i64,           // 8
    pub is_unlocked: bool,        // 1
    pub creator: Pubkey,          // 32
    pub bump: u8,                 // 1
}

impl ContentLock {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 32 + 1;
}

#[account]
pub struct GovernanceVote {
    pub proposal_id: u64,    // 8
    pub voter: Pubkey,       // 32
    pub nft_mint: Pubkey,    // 32
    pub vote: bool,          // 1
    pub voted_at: i64,       // 8
    pub bump: u8,            // 1
}

impl GovernanceVote {
    pub const LEN: usize = 8 + 8 + 32 + 32 + 1 + 8 + 1;
}

#[account]
pub struct RoyaltyClaim {
    pub nft_mint: Pubkey,    // 32
    pub holder: Pubkey,      // 32
    pub period_id: u64,      // 8
    pub amount: u64,         // 8
    pub is_claimed: bool,    // 1
    pub claimed_at: i64,     // 8
    pub bump: u8,            // 1
}

impl RoyaltyClaim {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 8 + 1;
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32])]
pub struct LockContent<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: NFT mint account — ownership validated via token account
    pub nft_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = ContentLock::LEN,
        seeds = [CONTENT_LOCK_SEED, nft_mint.key().as_ref(), content_hash.as_ref()],
        bump
    )]
    pub content_lock: Account<'info, ContentLock>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlockContent<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    /// CHECK: NFT mint — cross-checked with content_lock.nft_mint
    #[account(address = content_lock.nft_mint)]
    pub nft_mint: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CONTENT_LOCK_SEED, nft_mint.key().as_ref(), content_lock.content_hash.as_ref()],
        bump = content_lock.bump,
    )]
    pub content_lock: Account<'info, ContentLock>,

    #[account(
        token::mint = nft_mint,
        token::authority = holder,
    )]
    pub holder_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    /// CHECK: NFT mint — validated via token account
    pub nft_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = holder,
        space = GovernanceVote::LEN,
        seeds = [GOVERNANCE_VOTE_SEED, nft_mint.key().as_ref(), &proposal_id.to_le_bytes()],
        bump
    )]
    pub governance_vote: Account<'info, GovernanceVote>,

    #[account(
        token::mint = nft_mint,
        token::authority = holder,
    )]
    pub holder_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositRoyalty<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// CHECK: NFT mint — validated via seeds
    pub nft_mint: UncheckedAccount<'info>,

    /// CHECK: PDA vault holding royalty SOL — validated by seeds
    #[account(
        mut,
        seeds = [ROYALTY_VAULT_SEED, nft_mint.key().as_ref()],
        bump
    )]
    pub royalty_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(period_id: u64)]
pub struct ClaimRoyalty<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    /// CHECK: NFT mint — validated via token account
    pub nft_mint: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = holder,
        space = RoyaltyClaim::LEN,
        seeds = [ROYALTY_CLAIM_SEED, nft_mint.key().as_ref(), holder.key().as_ref(), &period_id.to_le_bytes()],
        bump
    )]
    pub royalty_claim: Account<'info, RoyaltyClaim>,

    /// CHECK: PDA vault — validated by seeds
    #[account(
        mut,
        seeds = [ROYALTY_VAULT_SEED, nft_mint.key().as_ref()],
        bump
    )]
    pub royalty_vault: UncheckedAccount<'info>,

    #[account(
        token::mint = nft_mint,
        token::authority = holder,
    )]
    pub holder_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct ContentLocked {
    pub nft_mint: Pubkey,
    pub content_hash: [u8; 32],
    pub unlock_at: i64,
}

#[event]
pub struct ContentUnlocked {
    pub nft_mint: Pubkey,
    pub content_hash: [u8; 32],
    pub unlocked_by: Pubkey,
}

#[event]
pub struct VoteCast {
    pub proposal_id: u64,
    pub voter: Pubkey,
    pub nft_mint: Pubkey,
    pub vote: bool,
}

#[event]
pub struct RoyaltyDeposited {
    pub nft_mint: Pubkey,
    pub amount: u64,
    pub depositor: Pubkey,
}

#[event]
pub struct RoyaltyClaimed {
    pub nft_mint: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub period_id: u64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum NftUtilityError {
    #[msg("Unlock time must be in the future")]
    UnlockTimeInPast,
    #[msg("Content is still time-locked")]
    ContentStillLocked,
    #[msg("Content has already been unlocked")]
    AlreadyUnlocked,
    #[msg("Caller does not hold the required VVIP NFT")]
    NotNftHolder,
    #[msg("Royalty has already been claimed for this period")]
    AlreadyClaimed,
    #[msg("Vault has insufficient balance to claim")]
    InsufficientVaultBalance,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
}

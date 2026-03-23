use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Stk1ngxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

pub const STAKE_SEED: &[u8] = b"stake_account";
pub const VAULT_SEED: &[u8] = b"stake_vault";

// Tier thresholds in raw token units (6 decimals)
pub const BRONZE_THRESHOLD: u64 = 1_000 * 10u64.pow(6);
pub const SILVER_THRESHOLD: u64 = 5_000 * 10u64.pow(6);
pub const GOLD_THRESHOLD: u64 = 25_000 * 10u64.pow(6);

// Yield rate: 5% APY expressed as basis points per second (approx)
// 500 bps / (365 * 24 * 3600) = ~158 bps-per-second scaled by 1e12
pub const YIELD_BPS_PER_SEC_SCALED: u128 = 15_855; // ~5% APY scaled by 1e12

#[program]
pub mod staking {
    use super::*;

    /// Stakes $SUMMON tokens and creates or updates the StakeAccount.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);

        // Transfer tokens from owner to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        let now = Clock::get()?.unix_timestamp;
        let stake_account = &mut ctx.accounts.stake_account;

        // If existing stake, settle pending yield first
        if stake_account.amount_staked > 0 {
            let pending = calculate_yield(
                stake_account.amount_staked,
                now - stake_account.last_yield_claim,
            );
            stake_account.pending_yield = stake_account
                .pending_yield
                .checked_add(pending)
                .ok_or(StakingError::MathOverflow)?;
        } else {
            stake_account.owner = ctx.accounts.owner.key();
            stake_account.staked_at = now;
            stake_account.bump = ctx.bumps.stake_account;
        }

        stake_account.amount_staked = stake_account
            .amount_staked
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        stake_account.tier = compute_tier(stake_account.amount_staked);
        stake_account.last_yield_claim = now;

        emit!(Staked {
            owner: ctx.accounts.owner.key(),
            amount,
            tier: stake_account.tier.clone(),
            total_staked: stake_account.amount_staked,
        });

        Ok(())
    }

    /// Unstakes $SUMMON tokens and returns them to the owner.
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        require!(
            ctx.accounts.stake_account.amount_staked >= amount,
            StakingError::InsufficientStake
        );

        let now = Clock::get()?.unix_timestamp;
        let stake_account = &mut ctx.accounts.stake_account;

        // Settle yield before unstaking
        let pending = calculate_yield(
            stake_account.amount_staked,
            now - stake_account.last_yield_claim,
        );
        stake_account.pending_yield = stake_account
            .pending_yield
            .checked_add(pending)
            .ok_or(StakingError::MathOverflow)?;
        stake_account.last_yield_claim = now;

        stake_account.amount_staked = stake_account
            .amount_staked
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;
        stake_account.tier = compute_tier(stake_account.amount_staked);

        // Transfer tokens from vault back to owner
        let mint_key = ctx.accounts.summon_mint.key();
        let vault_seeds = &[VAULT_SEED, mint_key.as_ref(), &[ctx.bumps.vault]];
        let signer_seeds = &[&vault_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        emit!(Unstaked {
            owner: ctx.accounts.owner.key(),
            amount,
            remaining: stake_account.amount_staked,
        });

        Ok(())
    }

    /// Claims accrued yield tokens from staking rewards.
    pub fn claim_yield(ctx: Context<ClaimYield>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let stake_account = &mut ctx.accounts.stake_account;

        require!(
            stake_account.amount_staked > 0,
            StakingError::NoActiveStake
        );

        let period_yield = calculate_yield(
            stake_account.amount_staked,
            now - stake_account.last_yield_claim,
        );
        let claimable = stake_account
            .pending_yield
            .checked_add(period_yield)
            .ok_or(StakingError::MathOverflow)?;

        require!(claimable > 0, StakingError::NoYieldAvailable);

        stake_account.pending_yield = 0;
        stake_account.last_yield_claim = now;

        // Yield minting is handled externally — emit event for off-chain handler
        emit!(YieldClaimed {
            owner: ctx.accounts.owner.key(),
            amount: claimable,
            tier: stake_account.tier.clone(),
        });

        Ok(())
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

pub fn compute_tier(amount: u64) -> StakingTier {
    if amount >= GOLD_THRESHOLD {
        StakingTier::Gold
    } else if amount >= SILVER_THRESHOLD {
        StakingTier::Silver
    } else if amount >= BRONZE_THRESHOLD {
        StakingTier::Bronze
    } else {
        StakingTier::None
    }
}

/// Returns accrued yield in token units for a given staked amount and elapsed seconds.
pub fn calculate_yield(amount_staked: u64, elapsed_secs: i64) -> u64 {
    if elapsed_secs <= 0 {
        return 0;
    }
    // yield = amount * 5% * (elapsed / 365_days)
    // Using integer math: amount * elapsed * YIELD_BPS_PER_SEC_SCALED / (10000 * 1e12)
    let result = (amount_staked as u128)
        .saturating_mul(elapsed_secs as u128)
        .saturating_mul(YIELD_BPS_PER_SEC_SCALED)
        / (10_000u128 * 1_000_000_000_000u128);
    result as u64
}

// ─── Account Structures ───────────────────────────────────────────────────────

#[account]
pub struct StakeAccount {
    pub owner: Pubkey,           // 32
    pub amount_staked: u64,      // 8
    pub tier: StakingTier,       // 1
    pub staked_at: i64,          // 8
    pub last_yield_claim: i64,   // 8
    pub pending_yield: u64,      // 8
    pub bump: u8,                // 1
}

impl StakeAccount {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum StakingTier {
    None,
    Bronze,  // 1,000 SUMMON — priority_access
    Silver,  // 5,000 SUMMON — guaranteed_slot
    Gold,    // 25,000 SUMMON — vvip_plus_meet_greet
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub summon_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        init_if_needed,
        payer = owner,
        space = StakeAccount::LEN,
        seeds = [STAKE_SEED, owner.key().as_ref(), summon_mint.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        mut,
        token::mint = summon_mint,
        token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        token::mint = summon_mint,
        token::authority = vault,
        seeds = [VAULT_SEED, summon_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub summon_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        mut,
        seeds = [STAKE_SEED, owner.key().as_ref(), summon_mint.key().as_ref()],
        bump = stake_account.bump,
        has_one = owner @ StakingError::UnauthorizedOwner,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        mut,
        token::mint = summon_mint,
        token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = summon_mint,
        seeds = [VAULT_SEED, summon_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimYield<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub summon_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(
        mut,
        seeds = [STAKE_SEED, owner.key().as_ref(), summon_mint.key().as_ref()],
        bump = stake_account.bump,
        has_one = owner @ StakingError::UnauthorizedOwner,
    )]
    pub stake_account: Account<'info, StakeAccount>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct Staked {
    pub owner: Pubkey,
    pub amount: u64,
    pub tier: StakingTier,
    pub total_staked: u64,
}

#[event]
pub struct Unstaked {
    pub owner: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[event]
pub struct YieldClaimed {
    pub owner: Pubkey,
    pub amount: u64,
    pub tier: StakingTier,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum StakingError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("No active stake found")]
    NoActiveStake,
    #[msg("No yield available to claim")]
    NoYieldAvailable,
    #[msg("Only the stake owner can perform this action")]
    UnauthorizedOwner,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}

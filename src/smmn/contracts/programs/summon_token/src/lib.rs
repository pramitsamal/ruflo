use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("SumnTkxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

pub const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";
pub const SUMMON_DECIMALS: u8 = 6;
pub const SUMMON_MAX_SUPPLY: u64 = 100_000_000 * 10u64.pow(6); // 100M tokens

#[program]
pub mod summon_token {
    use super::*;

    /// Initializes the $SUMMON SPL token mint with 6 decimals.
    /// Mint authority is a PDA controlled by this program.
    pub fn initialize_mint(ctx: Context<InitializeMint>) -> Result<()> {
        let config = &mut ctx.accounts.mint_config;
        config.mint = ctx.accounts.mint.key();
        config.authority_bump = ctx.bumps.mint_authority;
        config.bump = ctx.bumps.mint_config;
        config.total_minted = 0;

        emit!(MintInitialized {
            mint: ctx.accounts.mint.key(),
            authority: ctx.accounts.mint_authority.key(),
        });

        Ok(())
    }

    /// Mints $SUMMON tokens to the target account.
    /// Only callable by the program's mint authority PDA.
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, SummonError::ZeroAmount);

        let config = &ctx.accounts.mint_config;
        let new_total = config
            .total_minted
            .checked_add(amount)
            .ok_or(SummonError::MathOverflow)?;
        require!(new_total <= SUMMON_MAX_SUPPLY, SummonError::MaxSupplyExceeded);

        let seeds = &[
            MINT_AUTHORITY_SEED,
            ctx.accounts.mint_config.mint.as_ref(),
            &[ctx.accounts.mint_config.authority_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        ctx.accounts.mint_config.total_minted = new_total;

        emit!(TokensMinted {
            mint: ctx.accounts.mint.key(),
            destination: ctx.accounts.destination.key(),
            amount,
        });

        Ok(())
    }

    /// Burns $SUMMON tokens from the caller's account.
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, SummonError::ZeroAmount);
        require!(
            ctx.accounts.source.amount >= amount,
            SummonError::InsufficientBalance
        );

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.source.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        ctx.accounts.mint_config.total_minted = ctx
            .accounts
            .mint_config
            .total_minted
            .saturating_sub(amount);

        emit!(TokensBurned {
            mint: ctx.accounts.mint.key(),
            source: ctx.accounts.source.key(),
            amount,
        });

        Ok(())
    }
}

// ─── Account Structures ───────────────────────────────────────────────────────

#[account]
pub struct MintConfig {
    pub mint: Pubkey,         // 32
    pub total_minted: u64,    // 8
    pub authority_bump: u8,   // 1
    pub bump: u8,             // 1
}

impl MintConfig {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1;
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        mint::decimals = SUMMON_DECIMALS,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA mint authority — validated by seeds
    #[account(
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = MintConfig::LEN,
        seeds = [b"mint_config", mint.key().as_ref()],
        bump
    )]
    pub mint_config: Account<'info, MintConfig>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, address = mint_config.mint)]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA mint authority — validated by seeds
    #[account(
        seeds = [MINT_AUTHORITY_SEED, mint.key().as_ref()],
        bump = mint_config.authority_bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"mint_config", mint.key().as_ref()],
        bump = mint_config.bump,
    )]
    pub mint_config: Account<'info, MintConfig>,

    #[account(mut, token::mint = mint)]
    pub destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, address = mint_config.mint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"mint_config", mint.key().as_ref()],
        bump = mint_config.bump,
    )]
    pub mint_config: Account<'info, MintConfig>,

    #[account(mut, token::mint = mint, token::authority = owner)]
    pub source: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct MintInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct TokensMinted {
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokensBurned {
    pub mint: Pubkey,
    pub source: Pubkey,
    pub amount: u64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum SummonError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Would exceed maximum supply of 100M SUMMON")]
    MaxSupplyExceeded,
    #[msg("Insufficient token balance")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}

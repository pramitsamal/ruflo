use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;

declare_id!("RevShxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

pub const AGREEMENT_SEED: &[u8] = b"revenue_agreement";
pub const VAULT_SEED: &[u8] = b"revenue_vault";
pub const MAX_PARTNERS: usize = 5;
pub const TOTAL_BPS: u16 = 10_000; // 100% in basis points

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RevenueSource {
    TicketSales,
    Merchandise,
    Streaming,
    Sponsorship,
    Other,
}

#[program]
pub mod revenue_share {
    use super::*;

    /// Creates a revenue sharing agreement for an event.
    pub fn create_agreement(
        ctx: Context<CreateAgreement>,
        event_id: [u8; 32],
        partners: Vec<PartnerShare>,
        smmn_share_bps: u16,
        production_cost: u64,
    ) -> Result<()> {
        require!(
            partners.len() <= MAX_PARTNERS,
            RevenueShareError::TooManyPartners
        );
        require!(
            !partners.is_empty(),
            RevenueShareError::NoPartners
        );

        // Validate total BPS
        let partner_total: u16 = partners
            .iter()
            .map(|p| p.share_bps)
            .try_fold(0u16, |acc, bps| acc.checked_add(bps))
            .ok_or(RevenueShareError::MathOverflow)?;

        let total = partner_total
            .checked_add(smmn_share_bps)
            .ok_or(RevenueShareError::MathOverflow)?;

        require!(total == TOTAL_BPS, RevenueShareError::InvalidShareAllocation);

        let agreement = &mut ctx.accounts.agreement;
        agreement.event_id = event_id;
        agreement.smmn_authority = ctx.accounts.smmn_authority.key();
        agreement.partners = partners;
        agreement.smmn_share_bps = smmn_share_bps;
        agreement.production_cost = production_cost;
        agreement.total_revenue = 0;
        agreement.is_distributed = false;
        agreement.vault_bump = ctx.bumps.vault;
        agreement.bump = ctx.bumps.agreement;

        emit!(AgreementCreated {
            event_id,
            smmn_authority: ctx.accounts.smmn_authority.key(),
            partner_count: agreement.partners.len() as u8,
        });

        Ok(())
    }

    /// Records incoming revenue for an event into the vault.
    pub fn record_revenue(
        ctx: Context<RecordRevenue>,
        amount: u64,
        source: RevenueSource,
    ) -> Result<()> {
        require!(amount > 0, RevenueShareError::ZeroAmount);
        require!(
            !ctx.accounts.agreement.is_distributed,
            RevenueShareError::AlreadyDistributed
        );

        // Transfer SOL from payer to vault
        anchor_lang::solana_program::program::invoke(
            &system_instruction::transfer(
                ctx.accounts.payer.key,
                ctx.accounts.vault.key,
                amount,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        ctx.accounts.agreement.total_revenue = ctx
            .accounts
            .agreement
            .total_revenue
            .checked_add(amount)
            .ok_or(RevenueShareError::MathOverflow)?;

        emit!(RevenueRecorded {
            event_id: ctx.accounts.agreement.event_id,
            amount,
            source,
            total: ctx.accounts.agreement.total_revenue,
        });

        Ok(())
    }

    /// Distributes revenue to all partners and SMMN according to their shares.
    /// Only callable by SMMN authority after production costs are covered.
    pub fn distribute(ctx: Context<Distribute>) -> Result<()> {
        let agreement = &ctx.accounts.agreement;

        require!(
            agreement.smmn_authority == ctx.accounts.smmn_authority.key(),
            RevenueShareError::UnauthorizedDistributor
        );
        require!(
            !agreement.is_distributed,
            RevenueShareError::AlreadyDistributed
        );
        require!(
            agreement.total_revenue > agreement.production_cost,
            RevenueShareError::RevenueCoversProductionOnly
        );

        let distributable = agreement
            .total_revenue
            .checked_sub(agreement.production_cost)
            .ok_or(RevenueShareError::MathOverflow)?;

        let event_id = agreement.event_id;
        let vault_bump = agreement.vault_bump;
        let seeds = &[VAULT_SEED, event_id.as_ref(), &[vault_bump]];
        let signer_seeds = &[&seeds[..]];

        // Pay SMMN share
        let smmn_amount = (distributable as u128)
            .checked_mul(agreement.smmn_share_bps as u128)
            .ok_or(RevenueShareError::MathOverflow)?
            .checked_div(TOTAL_BPS as u128)
            .ok_or(RevenueShareError::MathOverflow)? as u64;

        anchor_lang::solana_program::program::invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.smmn_authority.key,
                smmn_amount,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.smmn_authority.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        ctx.accounts.agreement.is_distributed = true;

        emit!(RevenueDistributed {
            event_id,
            distributable,
            smmn_amount,
        });

        Ok(())
    }

    /// Releases funds for an individual partner (called per-partner after distribute).
    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        let agreement = &ctx.accounts.agreement;

        let partner = agreement
            .partners
            .iter()
            .find(|p| p.wallet == ctx.accounts.partner.key())
            .ok_or(RevenueShareError::PartnerNotFound)?;

        let distributable = agreement
            .total_revenue
            .checked_sub(agreement.production_cost)
            .ok_or(RevenueShareError::MathOverflow)?;

        let partner_amount = (distributable as u128)
            .checked_mul(partner.share_bps as u128)
            .ok_or(RevenueShareError::MathOverflow)?
            .checked_div(TOTAL_BPS as u128)
            .ok_or(RevenueShareError::MathOverflow)? as u64;

        let event_id = agreement.event_id;
        let vault_bump = agreement.vault_bump;
        let seeds = &[VAULT_SEED, event_id.as_ref(), &[vault_bump]];
        let signer_seeds = &[&seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.partner.key,
                partner_amount,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.partner.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        emit!(FundsReleased {
            event_id,
            partner: ctx.accounts.partner.key(),
            amount: partner_amount,
        });

        Ok(())
    }
}

// ─── Account Structures ───────────────────────────────────────────────────────

#[account]
pub struct RevenueAgreement {
    pub event_id: [u8; 32],           // 32
    pub smmn_authority: Pubkey,       // 32
    pub partners: Vec<PartnerShare>,  // 4 + 5*(32+2) = 174
    pub smmn_share_bps: u16,          // 2
    pub production_cost: u64,         // 8
    pub total_revenue: u64,           // 8
    pub is_distributed: bool,         // 1
    pub vault_bump: u8,               // 1
    pub bump: u8,                     // 1
}

impl RevenueAgreement {
    pub const LEN: usize = 8 + 32 + 32 + (4 + MAX_PARTNERS * (32 + 2)) + 2 + 8 + 8 + 1 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PartnerShare {
    pub wallet: Pubkey,    // 32
    pub share_bps: u16,    // basis points: 50% = 5000
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(event_id: [u8; 32])]
pub struct CreateAgreement<'info> {
    #[account(mut)]
    pub smmn_authority: Signer<'info>,

    #[account(
        init,
        payer = smmn_authority,
        space = RevenueAgreement::LEN,
        seeds = [AGREEMENT_SEED, event_id.as_ref()],
        bump
    )]
    pub agreement: Account<'info, RevenueAgreement>,

    /// CHECK: PDA vault holding event SOL — validated by seeds
    #[account(
        mut,
        seeds = [VAULT_SEED, event_id.as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordRevenue<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, seeds = [AGREEMENT_SEED, agreement.event_id.as_ref()], bump = agreement.bump)]
    pub agreement: Account<'info, RevenueAgreement>,

    /// CHECK: PDA vault — validated by seeds
    #[account(
        mut,
        seeds = [VAULT_SEED, agreement.event_id.as_ref()],
        bump = agreement.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Distribute<'info> {
    #[account(mut)]
    pub smmn_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [AGREEMENT_SEED, agreement.event_id.as_ref()],
        bump = agreement.bump,
        has_one = smmn_authority @ RevenueShareError::UnauthorizedDistributor,
    )]
    pub agreement: Account<'info, RevenueAgreement>,

    /// CHECK: PDA vault — validated by seeds
    #[account(
        mut,
        seeds = [VAULT_SEED, agreement.event_id.as_ref()],
        bump = agreement.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    #[account(mut)]
    pub partner: Signer<'info>,

    #[account(
        seeds = [AGREEMENT_SEED, agreement.event_id.as_ref()],
        bump = agreement.bump,
    )]
    pub agreement: Account<'info, RevenueAgreement>,

    /// CHECK: PDA vault — validated by seeds
    #[account(
        mut,
        seeds = [VAULT_SEED, agreement.event_id.as_ref()],
        bump = agreement.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct AgreementCreated {
    pub event_id: [u8; 32],
    pub smmn_authority: Pubkey,
    pub partner_count: u8,
}

#[event]
pub struct RevenueRecorded {
    pub event_id: [u8; 32],
    pub amount: u64,
    pub source: RevenueSource,
    pub total: u64,
}

#[event]
pub struct RevenueDistributed {
    pub event_id: [u8; 32],
    pub distributable: u64,
    pub smmn_amount: u64,
}

#[event]
pub struct FundsReleased {
    pub event_id: [u8; 32],
    pub partner: Pubkey,
    pub amount: u64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum RevenueShareError {
    #[msg("Too many partners: maximum 5 allowed")]
    TooManyPartners,
    #[msg("At least one partner is required")]
    NoPartners,
    #[msg("Share allocations must total exactly 10000 basis points (100%)")]
    InvalidShareAllocation,
    #[msg("Revenue has already been distributed")]
    AlreadyDistributed,
    #[msg("Only SMMN authority can distribute revenue")]
    UnauthorizedDistributor,
    #[msg("Revenue does not exceed production cost")]
    RevenueCoversProductionOnly,
    #[msg("Partner wallet not found in agreement")]
    PartnerNotFound,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}

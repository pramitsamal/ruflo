<script lang="ts">
  // Backer Dashboard — fan's NFT wallet and backed events

  const myNfts = [
    {
      mint: '7xKD...3faR',
      event: 'Moderat @ Lisbon',
      date: 'Apr 12, 2026',
      tier: 'VVIP',
      accessStatus: 'upcoming',
      royaltyAccrued: 0,
    },
    {
      mint: '2mBq...9pLw',
      event: 'Four Tet @ Berlin',
      date: 'May 3, 2026',
      tier: 'VVIP',
      accessStatus: 'upcoming',
      royaltyAccrued: 12.50,
    },
  ];

  const governanceProposals = [
    { id: 1, event: 'Moderat @ Lisbon', question: 'Opener Selection: Actress vs Emptyset', deadline: 'Mar 30, 2026', voted: false },
    { id: 2, event: 'Four Tet @ Berlin', question: 'Setlist Vote: More ambient or club-focused?', deadline: 'Apr 5, 2026', voted: true },
  ];
</script>

<svelte:head>
  <title>My Dashboard — SMMN</title>
</svelte:head>

<div class="mb-8">
  <h1 class="text-3xl font-bold">My Backer Dashboard</h1>
  <p class="mt-1 text-gray-400">Your VVIP NFTs, backed events, and governance rights</p>
</div>

<div class="grid gap-8 lg:grid-cols-3">
  <div class="lg:col-span-2 space-y-8">
    <!-- My VVIP NFTs -->
    <section>
      <h2 class="mb-4 text-xl font-bold">My VVIP NFTs</h2>
      {#if myNfts.length === 0}
        <div class="rounded-xl bg-gray-900 p-10 text-center text-gray-500">
          No NFTs yet. Back an event to get your VVIP pass.
        </div>
      {:else}
        <div class="grid gap-4 sm:grid-cols-2">
          {#each myNfts as nft}
            <div class="rounded-xl bg-gray-900 p-5">
              <!-- NFT visual placeholder -->
              <div class="mb-4 flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-purple-900 to-gray-800">
                <span class="text-4xl">🎵</span>
              </div>
              <div class="font-bold">{nft.event}</div>
              <div class="mb-2 text-sm text-gray-400">{nft.date}</div>
              <div class="flex items-center justify-between">
                <span class="rounded bg-purple-900/50 px-2 py-0.5 text-xs font-bold text-purple-300">
                  {nft.tier}
                </span>
                {#if nft.royaltyAccrued > 0}
                  <button class="text-xs text-green-400 hover:underline">
                    Claim ${nft.royaltyAccrued.toFixed(2)} royalty
                  </button>
                {/if}
              </div>
              <div class="mt-2 text-xs font-mono text-gray-600">{nft.mint}</div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Governance Votes -->
    <section>
      <h2 class="mb-4 text-xl font-bold">Governance Votes</h2>
      <div class="divide-y divide-gray-800 rounded-xl bg-gray-900">
        {#each governanceProposals as proposal}
          <div class="flex items-center justify-between p-5">
            <div>
              <div class="text-sm font-bold text-purple-400">{proposal.event}</div>
              <div class="font-medium">{proposal.question}</div>
              <div class="text-xs text-gray-500">Deadline: {proposal.deadline}</div>
            </div>
            {#if proposal.voted}
              <span class="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">Voted</span>
            {:else}
              <button class="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500">
                Vote Now
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  </div>

  <!-- Staking Summary Sidebar -->
  <div>
    <div class="rounded-xl bg-gray-900 p-6">
      <h2 class="mb-4 text-xl font-bold">$SUMMON Staking</h2>
      <div class="mb-4 rounded-lg bg-gray-800 p-4">
        <div class="mb-1 text-sm text-gray-400">Currently Staked</div>
        <div class="text-2xl font-bold">0 $SUMMON</div>
        <div class="text-sm text-gray-500">Tier: None</div>
      </div>

      <div class="mb-6 space-y-3">
        {#each [
          { tier: 'Bronze', amount: '1,000', benefit: 'Priority Backer access', color: 'text-amber-600' },
          { tier: 'Silver', amount: '5,000', benefit: 'Guaranteed Backer slot', color: 'text-gray-300' },
          { tier: 'Gold', amount: '25,000', benefit: 'VVIP + Meet & Greet', color: 'text-yellow-400' },
        ] as tier}
          <div class="flex items-center gap-3">
            <span class="text-lg {tier.color}">●</span>
            <div>
              <div class="text-sm font-medium {tier.color}">{tier.tier} — {tier.amount} $SUMMON</div>
              <div class="text-xs text-gray-500">{tier.benefit}</div>
            </div>
          </div>
        {/each}
      </div>

      <a
        href="/smmn/token"
        class="block w-full rounded-lg bg-purple-600 py-3 text-center font-semibold hover:bg-purple-500"
      >
        Stake $SUMMON
      </a>
    </div>
  </div>
</div>

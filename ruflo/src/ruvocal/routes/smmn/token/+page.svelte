<script lang="ts">
  import { writable } from 'svelte/store';

  const stakeAmount = writable('');
  const unstakeAmount = writable('');
  const activeTab = writable<'stake' | 'unstake' | 'yield'>('stake');

  const walletBalance = 0;
  const stakedBalance = 0;
  const pendingYield = 0;
  const currentTier = 'none';

  const tiers = [
    { name: 'Bronze', threshold: 1000, benefit: 'Priority Backer access', color: 'amber' },
    { name: 'Silver', threshold: 5000, benefit: 'Guaranteed Backer slot', color: 'gray' },
    { name: 'Gold', threshold: 25000, benefit: 'VVIP + Meet & Greet', color: 'yellow' },
  ];

  const stats = [
    { label: 'Total Staked', value: '12.4M $SUMMON' },
    { label: 'APY (30d avg)', value: '18.2%' },
    { label: 'Stakers', value: '4,821' },
    { label: 'Next Yield Drop', value: '3d 14h' },
  ];
</script>

<svelte:head>
  <title>$SUMMON Staking — SMMN</title>
</svelte:head>

<div class="mb-8">
  <h1 class="text-3xl font-bold">$SUMMON Token Staking</h1>
  <p class="mt-1 text-gray-400">Stake $SUMMON to unlock platform tiers and earn yield from event revenue</p>
</div>

<!-- Platform Staking Stats -->
<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
  {#each stats as stat}
    <div class="rounded-xl bg-gray-900 p-5 text-center">
      <div class="text-xl font-bold text-purple-400">{stat.value}</div>
      <div class="mt-1 text-sm text-gray-500">{stat.label}</div>
    </div>
  {/each}
</div>

<div class="grid gap-8 lg:grid-cols-3">
  <!-- Staking Actions -->
  <div class="lg:col-span-2">
    <!-- Tabs -->
    <div class="mb-6 flex gap-1 rounded-xl bg-gray-900 p-1">
      {#each ['stake', 'unstake', 'yield'] as tab}
        <button
          on:click={() => activeTab.set(tab)}
          class="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors
            {$activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}"
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      {/each}
    </div>

    <div class="rounded-xl bg-gray-900 p-6">
      {#if $activeTab === 'stake'}
        <h2 class="mb-4 text-lg font-bold">Stake $SUMMON</h2>
        <div class="mb-2 flex justify-between text-sm text-gray-400">
          <span>Available balance</span>
          <span>{walletBalance.toLocaleString()} $SUMMON</span>
        </div>
        <div class="mb-4 flex items-center rounded-lg bg-gray-800 px-4 py-3">
          <input
            type="number"
            placeholder="0"
            bind:value={$stakeAmount}
            class="flex-1 bg-transparent text-xl font-bold outline-none"
          />
          <button class="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600">MAX</button>
          <span class="ml-3 text-gray-400">$SUMMON</span>
        </div>
        <button
          class="w-full rounded-lg bg-purple-600 py-3 font-bold hover:bg-purple-500
            disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!$stakeAmount || Number($stakeAmount) <= 0}
        >
          Stake $SUMMON
        </button>
        <p class="mt-3 text-center text-xs text-gray-500">
          Unstaking requires a 7-day cooldown period
        </p>

      {:else if $activeTab === 'unstake'}
        <h2 class="mb-4 text-lg font-bold">Unstake $SUMMON</h2>
        <div class="mb-2 flex justify-between text-sm text-gray-400">
          <span>Staked balance</span>
          <span>{stakedBalance.toLocaleString()} $SUMMON</span>
        </div>
        <div class="mb-4 flex items-center rounded-lg bg-gray-800 px-4 py-3">
          <input
            type="number"
            placeholder="0"
            bind:value={$unstakeAmount}
            class="flex-1 bg-transparent text-xl font-bold outline-none"
          />
          <button class="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600">MAX</button>
          <span class="ml-3 text-gray-400">$SUMMON</span>
        </div>
        <button
          class="w-full rounded-lg bg-gray-700 py-3 font-bold hover:bg-gray-600
            disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!$unstakeAmount || Number($unstakeAmount) <= 0}
        >
          Request Unstake (7-day cooldown)
        </button>

      {:else}
        <h2 class="mb-4 text-lg font-bold">Claim Yield</h2>
        <div class="mb-6 rounded-lg bg-gray-800 p-5 text-center">
          <div class="mb-1 text-sm text-gray-400">Pending Yield</div>
          <div class="text-3xl font-bold text-green-400">{pendingYield} $SUMMON</div>
          <div class="text-sm text-gray-500">= ~$0.00 USD</div>
        </div>
        <button
          class="w-full rounded-lg bg-green-600 py-3 font-bold hover:bg-green-500
            disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pendingYield <= 0}
        >
          Claim Yield
        </button>
        <p class="mt-3 text-center text-xs text-gray-500">
          Yield is distributed from 30% of SMMN platform revenue
        </p>
      {/if}
    </div>
  </div>

  <!-- Tier Info -->
  <div>
    <div class="rounded-xl bg-gray-900 p-6">
      <h2 class="mb-4 text-lg font-bold">Staking Tiers</h2>
      <div class="space-y-4">
        {#each tiers as tier}
          <div class="rounded-lg bg-gray-800 p-4 {currentTier === tier.name.toLowerCase() ? 'ring-1 ring-purple-500' : ''}">
            <div class="mb-1 flex items-center justify-between">
              <span class="font-bold
                {tier.name === 'Bronze' ? 'text-amber-600' :
                 tier.name === 'Silver' ? 'text-gray-300' : 'text-yellow-400'}">
                {tier.name}
              </span>
              <span class="text-sm text-gray-400">{tier.threshold.toLocaleString()} $SUMMON</span>
            </div>
            <div class="text-sm text-gray-400">{tier.benefit}</div>
            {#if currentTier === tier.name.toLowerCase()}
              <div class="mt-2 text-xs font-medium text-purple-400">✓ Current Tier</div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="mt-4 rounded-lg bg-gray-800 p-4">
        <div class="mb-2 text-sm font-medium text-gray-400">All Stakers Receive</div>
        <ul class="space-y-1 text-sm text-gray-300">
          <li>✓ 20% fee discount in $SUMMON</li>
          <li>✓ Pro-rata yield from platform revenue</li>
          <li>✓ Governance voting weight</li>
        </ul>
      </div>
    </div>
  </div>
</div>

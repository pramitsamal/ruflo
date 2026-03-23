<script lang="ts">
  import { page } from '$app/stores';

  // Mock event data — in production loaded from +page.server.ts
  const event = {
    id: $page.params.id,
    artist: 'Moderat',
    city: 'Lisbon',
    country: 'PT',
    venue: 'LX Factory',
    date: 'Apr 12, 2026',
    guarantee: 50000,
    productionBudget: 80000,
    capacity: 1200,
    slotsTotal: 125,
    slotsFilled: 87,
    slotPrice: 440,
    platformFee: 44,         // 10% of slot price
    status: 'open',
    ticketTiers: [
      { name: 'GA', price: 80, quantity: 800, sold: 0 },
      { name: 'VIP', price: 150, quantity: 150, sold: 0 },
      { name: 'Premium Booth', price: 2000, quantity: 20, sold: 0 },
    ],
    sponsorships: [
      { brand: 'Phantom Wallet', amount: 20000, status: 'confirmed' },
      { brand: 'TBD Beverage', amount: 15000, status: 'pending' },
    ],
    vvipBenefits: [
      'Best seats + exclusive pre-show lounge access',
      'Unique digital collectible NFT from the artist',
      'Influence setlist & opener selection',
      'Priority access to future SMMN events',
      '5% secondary market royalty share',
    ],
  };

  const fillPct = Math.round((event.slotsFilled / event.slotsTotal) * 100);
  const remainingSlots = event.slotsTotal - event.slotsFilled;

  // Revenue projection
  const backerRevenue = event.slotsFilled * event.slotPrice;
  const sponsorRevenue = event.sponsorships
    .filter(s => s.status === 'confirmed')
    .reduce((sum, s) => sum + s.amount, 0);
  const projectedTicketRevenue = event.ticketTiers.reduce(
    (sum, t) => sum + t.price * t.quantity * 0.7, // 70% sell-through estimate
    0
  );
  const totalRevenue = backerRevenue + sponsorRevenue + projectedTicketRevenue;
  const grossProfit = totalRevenue - event.productionBudget;
  const smmnProfit = grossProfit * 0.5;
</script>

<svelte:head>
  <title>{event.artist} · {event.city} — SMMN</title>
</svelte:head>

<!-- Back nav -->
<a href="/smmn/events" class="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
  ← All Events
</a>

<div class="grid gap-8 lg:grid-cols-3">
  <!-- Main info -->
  <div class="lg:col-span-2">
    <div class="mb-2 flex items-center gap-3">
      <h1 class="text-4xl font-bold">{event.artist}</h1>
      <span class="rounded-full bg-green-900/60 px-3 py-1 text-sm font-semibold text-green-400">
        BACKER ROUND OPEN
      </span>
    </div>
    <p class="mb-6 text-xl text-gray-400">{event.venue} · {event.city} · {event.date}</p>

    <!-- VVIP Benefits -->
    <div class="mb-8 rounded-xl bg-gray-900 p-6">
      <h2 class="mb-4 text-lg font-bold text-purple-400">VVIP Backer Benefits</h2>
      <ul class="space-y-2">
        {#each event.vvipBenefits as benefit}
          <li class="flex items-start gap-3 text-gray-300">
            <span class="mt-0.5 text-purple-400">✓</span>
            {benefit}
          </li>
        {/each}
      </ul>
    </div>

    <!-- Revenue Projection -->
    <div class="rounded-xl bg-gray-900 p-6">
      <h2 class="mb-4 text-lg font-bold">Event Economics</h2>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-400">Artist Guarantee</span>
          <span class="font-bold">${event.guarantee.toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Production Budget</span>
          <span>${event.productionBudget.toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Backer Revenue (current)</span>
          <span class="text-purple-400">${backerRevenue.toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Confirmed Sponsorships</span>
          <span class="text-purple-400">${sponsorRevenue.toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Projected Ticket Revenue</span>
          <span class="text-gray-300">${Math.round(projectedTicketRevenue).toLocaleString()}</span>
        </div>
        <div class="border-t border-gray-700 pt-3">
          <div class="flex justify-between font-bold">
            <span>Projected Gross Profit</span>
            <span class="text-green-400">${Math.round(grossProfit).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Backer Round Widget -->
  <div class="lg:sticky lg:top-8">
    <div class="rounded-xl bg-gray-900 p-6 ring-1 ring-purple-500/30">
      <h2 class="mb-4 text-xl font-bold">Back This Event</h2>

      <!-- Progress -->
      <div class="mb-4">
        <div class="mb-2 flex justify-between text-sm">
          <span class="text-gray-400">{event.slotsFilled} of {event.slotsTotal} backers</span>
          <span class="font-bold text-purple-400">{fillPct}% funded</span>
        </div>
        <div class="h-3 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            class="h-3 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all"
            style="width: {fillPct}%"
          ></div>
        </div>
        <p class="mt-2 text-sm text-gray-500">
          {remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining
        </p>
      </div>

      <!-- Pricing -->
      <div class="mb-6 rounded-lg bg-gray-800 p-4">
        <div class="mb-2 flex justify-between">
          <span class="text-gray-400">Backer slot price</span>
          <span class="text-2xl font-bold">${event.slotPrice}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Platform fee (10%)</span>
          <span class="text-gray-500">${event.platformFee}</span>
        </div>
        <div class="mt-2 flex justify-between text-sm font-medium">
          <span class="text-gray-400">Goes to artist guarantee</span>
          <span class="text-purple-400">${event.slotPrice - event.platformFee}</span>
        </div>
      </div>

      <button
        class="w-full rounded-lg bg-purple-600 py-3 font-bold hover:bg-purple-500
          disabled:cursor-not-allowed disabled:opacity-50"
        disabled={event.status !== 'open' || remainingSlots === 0}
      >
        {remainingSlots > 0 ? 'Purchase VVIP Backer Slot' : 'Round Filled'}
      </button>

      <p class="mt-3 text-center text-xs text-gray-500">
        Connect your Solana wallet to purchase
      </p>

      <!-- Ticket tiers preview -->
      <div class="mt-6 border-t border-gray-700 pt-6">
        <h3 class="mb-3 text-sm font-medium text-gray-400">General Ticket Tiers</h3>
        {#each event.ticketTiers as tier}
          <div class="mb-2 flex justify-between text-sm">
            <span class="text-gray-300">{tier.name}</span>
            <div class="text-right">
              <span class="font-bold">${tier.price}</span>
              <span class="ml-2 text-gray-500">{tier.quantity} available</span>
            </div>
          </div>
        {/each}
        <p class="mt-2 text-xs text-gray-600">General tickets go live after backer round fills</p>
      </div>
    </div>
  </div>
</div>

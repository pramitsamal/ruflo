<script lang="ts">
  import { writable } from 'svelte/store';

  const statusFilter = writable<'all' | 'open' | 'filled' | 'completed'>('all');

  // Mock data — in production fetched from /api/smmn/events
  const events = [
    { id: 'evt-001', artist: 'Moderat', city: 'Lisbon', country: 'PT', date: 'Apr 12, 2026', guarantee: 50000, slotsTotal: 125, slotsFilled: 87, slotPrice: 440, status: 'open', genre: ['Electronic', 'Experimental'] },
    { id: 'evt-002', artist: 'Four Tet', city: 'Berlin', country: 'DE', date: 'May 3, 2026', guarantee: 35000, slotsTotal: 88, slotsFilled: 88, slotPrice: 440, status: 'filled', genre: ['Electronic', 'House'] },
    { id: 'evt-003', artist: 'Jon Hopkins', city: 'Miami', country: 'US', date: 'Jun 18, 2026', guarantee: 60000, slotsTotal: 150, slotsFilled: 23, slotPrice: 440, status: 'open', genre: ['Ambient', 'Electronic'] },
    { id: 'evt-004', artist: 'Bonobo', city: 'Amsterdam', country: 'NL', date: 'Mar 28, 2026', guarantee: 45000, slotsTotal: 112, slotsFilled: 112, slotPrice: 440, status: 'completed', genre: ['Downtempo', 'Jazz'] },
  ];

  $: filtered = $statusFilter === 'all' ? events : events.filter(e => e.status === $statusFilter);
</script>

<svelte:head>
  <title>Events — SMMN</title>
</svelte:head>

<div class="mb-8 flex items-center justify-between">
  <h1 class="text-3xl font-bold">All Events</h1>
  <div class="flex gap-2">
    {#each ['all', 'open', 'filled', 'completed'] as f}
      <button
        on:click={() => statusFilter.set(f)}
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors
          {$statusFilter === f ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}"
      >
        {f.charAt(0).toUpperCase() + f.slice(1)}
      </button>
    {/each}
  </div>
</div>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {#each filtered as event}
    <a
      href="/smmn/events/{event.id}"
      class="block rounded-xl bg-gray-900 p-6 transition-all hover:bg-gray-800 hover:ring-1 hover:ring-purple-500"
    >
      <div class="mb-4 flex items-start justify-between">
        <div>
          <h2 class="text-xl font-bold">{event.artist}</h2>
          <p class="text-gray-400">{event.city}, {event.country}</p>
          <p class="text-sm text-gray-500">{event.date}</p>
        </div>
        <span class="
          rounded-full px-3 py-1 text-xs font-semibold
          {event.status === 'open' ? 'bg-green-900/60 text-green-400' :
           event.status === 'filled' ? 'bg-purple-900/60 text-purple-400' :
           'bg-gray-800 text-gray-400'}">
          {event.status.toUpperCase()}
        </span>
      </div>

      <div class="mb-1 flex justify-between text-xs text-gray-500">
        <span>{event.slotsFilled}/{event.slotsTotal} backers</span>
        <span>{Math.round((event.slotsFilled / event.slotsTotal) * 100)}%</span>
      </div>
      <div class="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
        <div
          class="h-1.5 rounded-full {event.status === 'open' ? 'bg-purple-500' : 'bg-gray-500'}"
          style="width: {Math.min((event.slotsFilled / event.slotsTotal) * 100, 100)}%"
        ></div>
      </div>

      <div class="flex flex-wrap gap-1">
        {#each event.genre as g}
          <span class="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{g}</span>
        {/each}
      </div>

      <div class="mt-4 flex justify-between text-sm">
        <div>
          <span class="text-gray-500">Slot: </span>
          <span class="font-bold">${event.slotPrice}</span>
        </div>
        <div>
          <span class="text-gray-500">Guarantee: </span>
          <span class="font-bold">${event.guarantee.toLocaleString()}</span>
        </div>
      </div>
    </a>
  {/each}
</div>

{#if filtered.length === 0}
  <div class="py-20 text-center text-gray-500">
    No events found for this filter.
  </div>
{/if}

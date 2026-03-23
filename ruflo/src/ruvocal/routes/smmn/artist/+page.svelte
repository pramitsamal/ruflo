<script lang="ts">
  // Artist Portal — dashboard for event organizers
  const activeEvents = [
    { id: 'evt-001', artist: 'Moderat', city: 'Lisbon', date: 'Apr 12, 2026', slotsFilled: 87, slotsTotal: 125, guarantee: 50000, status: 'backer_round_open' },
    { id: 'evt-002', artist: 'Four Tet', city: 'Berlin', date: 'May 3, 2026', slotsFilled: 88, slotsTotal: 88, guarantee: 35000, status: 'backer_round_filled' },
  ];
</script>

<svelte:head>
  <title>Artist Portal — SMMN</title>
</svelte:head>

<div class="mb-8 flex items-center justify-between">
  <div>
    <h1 class="text-3xl font-bold">Artist Portal</h1>
    <p class="mt-1 text-gray-400">Manage events, backer rounds, and financials</p>
  </div>
  <a
    href="/smmn/artist/create"
    class="rounded-lg bg-purple-600 px-5 py-2.5 font-semibold hover:bg-purple-500"
  >
    + Create Event
  </a>
</div>

<!-- Summary Cards -->
<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
  {#each [
    { label: 'Active Events', value: '2' },
    { label: 'Total Guarantees Paid', value: '$85K' },
    { label: 'Backers Secured', value: '175' },
    { label: 'Avg. Backer Round Fill', value: '94%' },
  ] as stat}
    <div class="rounded-xl bg-gray-900 p-5">
      <div class="text-2xl font-bold text-purple-400">{stat.value}</div>
      <div class="mt-1 text-sm text-gray-400">{stat.label}</div>
    </div>
  {/each}
</div>

<!-- Active Events Table -->
<div class="rounded-xl bg-gray-900">
  <div class="border-b border-gray-800 p-6">
    <h2 class="text-lg font-bold">Active Events</h2>
  </div>
  <div class="divide-y divide-gray-800">
    {#each activeEvents as event}
      <div class="flex items-center gap-4 p-6">
        <div class="flex-1">
          <div class="font-bold">{event.artist} · {event.city}</div>
          <div class="text-sm text-gray-400">{event.date}</div>
        </div>

        <!-- Backer progress -->
        <div class="w-40">
          <div class="mb-1 flex justify-between text-xs text-gray-500">
            <span>{event.slotsFilled}/{event.slotsTotal}</span>
            <span>{Math.round((event.slotsFilled / event.slotsTotal) * 100)}%</span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              class="h-1.5 rounded-full bg-purple-500"
              style="width: {(event.slotsFilled / event.slotsTotal) * 100}%"
            ></div>
          </div>
        </div>

        <div class="text-right">
          <div class="font-bold">${event.guarantee.toLocaleString()}</div>
          <div class="text-xs text-gray-500">guarantee</div>
        </div>

        <span class="
          rounded-full px-3 py-1 text-xs font-medium
          {event.status === 'backer_round_open' ? 'bg-green-900/50 text-green-400' : 'bg-purple-900/50 text-purple-400'}">
          {event.status === 'backer_round_open' ? 'Round Open' : 'Round Filled'}
        </span>

        <a
          href="/smmn/events/{event.id}"
          class="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
        >
          Manage
        </a>
      </div>
    {/each}
  </div>
</div>

<!-- How to Create an Event -->
<div class="mt-8 rounded-xl bg-gray-900 p-6">
  <h2 class="mb-4 text-lg font-bold">Create Your First Event</h2>
  <div class="grid gap-4 md:grid-cols-3">
    {#each [
      { step: '1', title: 'Submit Artist Details', desc: 'Provide artist info, venue, date, and set your guarantee amount.' },
      { step: '2', title: 'Launch Backer Round', desc: 'SMMN opens a limited-slot backer round. Fans back the show, you get paid.' },
      { step: '3', title: 'Event Execution', desc: 'SMMN handles production, ticketing, and sponsorship. You deliver the show.' },
    ] as phase}
      <div class="flex gap-3">
        <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold">
          {phase.step}
        </div>
        <div>
          <div class="font-medium">{phase.title}</div>
          <div class="text-sm text-gray-400">{phase.desc}</div>
        </div>
      </div>
    {/each}
  </div>
</div>

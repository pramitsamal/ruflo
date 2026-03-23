<script lang="ts">
  const stats = [
    { label: 'Events Backed', value: '47' },
    { label: 'Artist Guarantees', value: '$2.8M' },
    { label: 'Active Backers', value: '3,241' },
    { label: 'VVIP NFTs Minted', value: '8,190' },
  ];

  const featuredEvents = [
    {
      id: 'evt-001',
      artist: 'Moderat',
      city: 'Lisbon',
      date: 'Apr 12, 2026',
      guarantee: 50000,
      slotsTotal: 125,
      slotsFilled: 87,
      slotPrice: 440,
      status: 'open',
    },
    {
      id: 'evt-002',
      artist: 'Four Tet',
      city: 'Berlin',
      date: 'May 3, 2026',
      guarantee: 35000,
      slotsTotal: 88,
      slotsFilled: 88,
      slotPrice: 440,
      status: 'filled',
    },
    {
      id: 'evt-003',
      artist: 'Jon Hopkins',
      city: 'Miami',
      date: 'Jun 18, 2026',
      guarantee: 60000,
      slotsTotal: 150,
      slotsFilled: 23,
      slotPrice: 440,
      status: 'open',
    },
  ];
</script>

<svelte:head>
  <title>SMMN — Curated Co-Creation Events</title>
</svelte:head>

<!-- Hero -->
<section class="mb-16 text-center">
  <h1 class="mb-4 text-5xl font-bold">
    Back Artists.<br />
    <span class="text-purple-400">Own the Moment.</span>
  </h1>
  <p class="mx-auto mb-8 max-w-2xl text-lg text-gray-400">
    SMMN eliminates financial risk for artists. Back an event, receive a VVIP NFT,
    and become a true partner in cultural creation.
  </p>
  <div class="flex justify-center gap-4">
    <a
      href="/smmn/events"
      class="rounded-lg bg-purple-600 px-6 py-3 font-semibold hover:bg-purple-500"
    >
      Browse Events
    </a>
    <a
      href="/smmn/artist"
      class="rounded-lg border border-gray-700 px-6 py-3 font-semibold hover:border-gray-500"
    >
      Artist Portal
    </a>
  </div>
</section>

<!-- Platform Stats -->
<section class="mb-16 grid grid-cols-2 gap-4 md:grid-cols-4">
  {#each stats as stat}
    <div class="rounded-xl bg-gray-900 p-6 text-center">
      <div class="mb-1 text-3xl font-bold text-purple-400">{stat.value}</div>
      <div class="text-sm text-gray-400">{stat.label}</div>
    </div>
  {/each}
</section>

<!-- Featured Events -->
<section>
  <div class="mb-6 flex items-center justify-between">
    <h2 class="text-2xl font-bold">Live Backer Rounds</h2>
    <a href="/smmn/events" class="text-sm text-purple-400 hover:text-purple-300">
      View all →
    </a>
  </div>

  <div class="grid gap-6 md:grid-cols-3">
    {#each featuredEvents as event}
      <a
        href="/smmn/events/{event.id}"
        class="block rounded-xl bg-gray-900 p-6 transition-colors hover:bg-gray-800"
      >
        <div class="mb-3 flex items-start justify-between">
          <div>
            <h3 class="text-lg font-bold">{event.artist}</h3>
            <p class="text-sm text-gray-400">{event.city} · {event.date}</p>
          </div>
          <span
            class="rounded-full px-2 py-1 text-xs font-medium
              {event.status === 'open'
                ? 'bg-green-900 text-green-400'
                : 'bg-purple-900 text-purple-400'}"
          >
            {event.status === 'open' ? 'OPEN' : 'FILLED'}
          </span>
        </div>

        <!-- Fill progress bar -->
        <div class="mb-3">
          <div class="mb-1 flex justify-between text-xs text-gray-500">
            <span>{event.slotsFilled} / {event.slotsTotal} slots filled</span>
            <span>{Math.round((event.slotsFilled / event.slotsTotal) * 100)}%</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              class="h-2 rounded-full bg-purple-500 transition-all"
              style="width: {(event.slotsFilled / event.slotsTotal) * 100}%"
            ></div>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs text-gray-500">Slot price</div>
            <div class="font-bold">${event.slotPrice}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-gray-500">Artist guarantee</div>
            <div class="font-bold">${event.guarantee.toLocaleString()}</div>
          </div>
        </div>
      </a>
    {/each}
  </div>
</section>

<!-- How It Works -->
<section class="mt-20">
  <h2 class="mb-10 text-center text-3xl font-bold">How SMMN Works</h2>
  <div class="grid gap-8 md:grid-cols-3">
    {#each [
      {
        step: '01',
        title: 'Backer Round',
        desc: 'SMMN launches a limited backer round. Fans purchase VVIP slots to guarantee the artist's fee upfront.',
      },
      {
        step: '02',
        title: 'Artist Gets Paid',
        desc: 'Once all slots are filled, 100% of the artist fee is transferred immediately — before a single ticket is sold.',
      },
      {
        step: '03',
        title: 'You Own the Moment',
        desc: 'Your VVIP NFT unlocks exclusive access, governance rights, and secondary market royalties.',
      },
    ] as phase}
      <div class="rounded-xl bg-gray-900 p-6">
        <div class="mb-3 text-4xl font-black text-purple-400">{phase.step}</div>
        <h3 class="mb-2 text-xl font-bold">{phase.title}</h3>
        <p class="text-gray-400">{phase.desc}</p>
      </div>
    {/each}
  </div>
</section>

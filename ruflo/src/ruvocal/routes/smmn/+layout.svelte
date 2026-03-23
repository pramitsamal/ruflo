<script lang="ts">
  import { page } from '$app/stores';

  const navItems = [
    { label: 'Events', href: '/smmn/events' },
    { label: 'Artist Portal', href: '/smmn/artist' },
    { label: 'My Dashboard', href: '/smmn/backer' },
    { label: 'Stake $SUMMON', href: '/smmn/token' },
  ];
</script>

<div class="min-h-screen bg-gray-950 text-white">
  <!-- SMMN Header -->
  <header class="border-b border-gray-800 bg-gray-900 px-6 py-4">
    <div class="mx-auto flex max-w-7xl items-center justify-between">
      <a href="/smmn" class="text-2xl font-bold tracking-tight text-purple-400">
        SMMN
      </a>
      <nav class="flex items-center gap-6">
        {#each navItems as item}
          <a
            href={item.href}
            class="text-sm font-medium transition-colors
              {$page.url.pathname.startsWith(item.href)
                ? 'text-purple-400'
                : 'text-gray-300 hover:text-white'}"
          >
            {item.label}
          </a>
        {/each}
      </nav>
      <button
        class="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500"
      >
        Connect Wallet
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <main class="mx-auto max-w-7xl px-6 py-8">
    <slot />
  </main>
</div>

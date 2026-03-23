<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const navItems = [
    { label: 'Events', href: '/smmn/events' },
    { label: 'Artist Portal', href: '/smmn/artist' },
    { label: 'My Dashboard', href: '/smmn/backer' },
    { label: 'Stake $SUMMON', href: '/smmn/token' },
  ];

  // PWA install prompt
  let installPrompt: Event | null = null;
  let showInstallBanner = false;

  onMount(() => {
    // Capture the browser's native install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      // Only show if user hasn't dismissed before
      if (!localStorage.getItem('smmn-pwa-dismissed')) {
        showInstallBanner = true;
      }
    });

    // Hide banner if app is already installed
    window.addEventListener('appinstalled', () => {
      showInstallBanner = false;
      installPrompt = null;
    });
  });

  async function installApp() {
    if (!installPrompt) return;
    // @ts-expect-error — prompt() is on BeforeInstallPromptEvent
    await installPrompt.prompt();
    // @ts-expect-error
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      showInstallBanner = false;
    }
    installPrompt = null;
  }

  function dismissBanner() {
    showInstallBanner = false;
    localStorage.setItem('smmn-pwa-dismissed', '1');
  }
</script>

<div class="min-h-screen bg-gray-950 text-white">
  <!-- PWA Install Banner -->
  {#if showInstallBanner}
    <div class="flex items-center justify-between bg-purple-700 px-4 py-2.5 text-sm text-white">
      <div class="flex items-center gap-3">
        <span class="text-lg">📱</span>
        <span class="font-medium">Add SMMN to your home screen for quick access</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          on:click={installApp}
          class="rounded-lg bg-white px-3 py-1 font-semibold text-purple-700 hover:bg-purple-50"
        >
          Install
        </button>
        <button
          on:click={dismissBanner}
          class="p-1 text-purple-200 hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  {/if}

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

import { useState, useCallback } from 'react';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol';

const APP_IDENTITY = {
  name: 'SMMN',
  uri: 'https://smmn.app',
  icon: 'favicon.ico',
};

export function useWallet() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        });
        const base64Addr = authResult.accounts[0]?.address;
        if (base64Addr) {
          // Convert base64 to hex-style display address
          const bytes = Uint8Array.from(atob(base64Addr), (c) => c.charCodeAt(0));
          const hex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          setWalletAddress(hex.slice(0, 44));
        }
      });
    } catch (err) {
      console.warn('Wallet connect failed:', err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletAddress(null);
  }, []);

  const truncated = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  return { walletAddress, truncated, connecting, connect, disconnect };
}

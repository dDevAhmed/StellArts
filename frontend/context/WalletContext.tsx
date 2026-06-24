"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  ReactNode,
} from "react";

/** Minimal type for wallet kit — full module loaded only on client via dynamic import */
interface WalletKitInstance {
  openModal: (params: {
    onWalletSelected: (option: { id: string }) => void | Promise<void>;
  }) => Promise<void>;
  setWallet: (id: string) => void;
  getAddress: () => Promise<{ address: string }>;
  signTransaction: (
    xdr: string,
    opts?: { address?: string; networkPassphrase?: string },
  ) => Promise<{ signedTxXdr: string }>;
}

interface WalletContextType {
  walletAddress: string | null;
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  kit: WalletKitInstance | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | null>(null);

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const WALLET_STORAGE_KEY = "stellarts_wallet_address";

function isWalletRejectionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("reject") ||
    normalized.includes("denied") ||
    normalized.includes("cancel")
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [kit, setKit] = useState<WalletKitInstance | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const kitRef = useRef<WalletKitInstance | null>(null);

  useEffect(() => {
    let isMounted = true;

    const stored =
      typeof window !== "undefined"
        ? sessionStorage.getItem(WALLET_STORAGE_KEY)
        : null;
    if (stored) {
      setAddress(stored);
    }

    if (!kitRef.current) {
      import("@creit.tech/stellar-wallets-kit").then(
        ({
          StellarWalletsKit: Kit,
          WalletNetwork,
          allowAllModules,
          FREIGHTER_ID,
        }) => {
          if (!isMounted) return;
          const newKit = new Kit({
            network: WalletNetwork.TESTNET,
            selectedWalletId: FREIGHTER_ID,
            modules: allowAllModules(),
          });
          kitRef.current = newKit as WalletKitInstance;
          setKit(kitRef.current);
        },
      );
    }

    return () => {
      isMounted = false;
      if (kitRef.current) {
        const currentKit = kitRef.current as WalletKitInstance & {
          removeEventListeners?: () => void;
          disconnect?: () => void;
        };
        if (typeof currentKit.removeEventListeners === "function") {
          currentKit.removeEventListeners();
        } else if (typeof currentKit.disconnect === "function") {
          currentKit.disconnect();
        }
      }
    };
  }, []);

  const connectWallet = useCallback(async () => {
    if (!kit) throw new Error("Wallet kit not ready");
    setIsConnecting(true);
    try {
      await kit.openModal({
        onWalletSelected: async (option) => {
          kit.setWallet(option.id);
          const { address: addr } = await kit.getAddress();
          setAddress(addr);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(WALLET_STORAGE_KEY, addr);
          }
        },
      });
    } catch (err) {
      console.error("Wallet connection failed:", err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [kit]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }, []);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!address) throw new Error("Wallet not connected");
      if (!kit) throw new Error("Wallet kit not ready");
      if (!xdr?.trim()) throw new Error("Invalid transaction data");

      try {
        const { signedTxXdr } = await kit.signTransaction(xdr, {
          address,
          networkPassphrase: TESTNET_PASSPHRASE,
        });
        return signedTxXdr;
      } catch (err) {
        console.error("Wallet signing failed:", err);
        if (isWalletRejectionError(err)) {
          throw new Error("Transaction was rejected by wallet");
        }
        throw err;
      }
    },
    [kit, address],
  );

  const value = useMemo(
    () => ({
      walletAddress: address,
      address,
      isConnected: !!address,
      isConnecting,
      kit,
      connectWallet,
      disconnectWallet,
      connect: connectWallet,
      disconnect: disconnectWallet,
      signTransaction,
    }),
    [
      address,
      isConnecting,
      kit,
      connectWallet,
      disconnectWallet,
      signTransaction,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}

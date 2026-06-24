import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { WalletProvider, useWallet } from "@/context/WalletContext";

const mockKit = {
  openModal: vi.fn(
    async ({
      onWalletSelected,
    }: {
      onWalletSelected: (option: { id: string }) => Promise<void>;
    }) => {
      await onWalletSelected({ id: "freighter" });
    },
  ),
  setWallet: vi.fn(),
  getAddress: vi.fn(async () => ({
    address: "GTEST1234567890123456789012345678901234567890",
  })),
  signTransaction: vi.fn(async () => ({ signedTxXdr: "signed-xdr-value" })),
};

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: vi.fn(() => mockKit),
  WalletNetwork: { TESTNET: "testnet" },
  allowAllModules: vi.fn(() => []),
  FREIGHTER_ID: "freighter",
}));

async function flushWalletKitInit() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function WalletTester() {
  const {
    walletAddress,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    signTransaction,
  } = useWallet();

  return (
    <div>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="connecting">{String(isConnecting)}</span>
      <span data-testid="address">{walletAddress ?? "none"}</span>
      <button type="button" onClick={() => connectWallet()}>
        Connect Wallet
      </button>
      <button type="button" onClick={() => disconnectWallet()}>
        Disconnect Wallet
      </button>
      <button
        type="button"
        onClick={async () => {
          const signed = await signTransaction("unsigned-xdr");
          const target = document.querySelector("[data-testid='signed']");
          if (target) target.textContent = signed;
        }}
      >
        Sign Transaction
      </button>
      <span data-testid="signed" />
    </div>
  );
}

describe("WalletContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockKit.signTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr-value" });
  });

  it("connects wallet and exposes address", async () => {
    render(
      <WalletProvider>
        <WalletTester />
      </WalletProvider>,
    );

    await flushWalletKitInit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("true");
      expect(screen.getByTestId("address").textContent).toContain("GTEST");
    });
  });

  it("disconnects wallet", async () => {
    render(
      <WalletProvider>
        <WalletTester />
      </WalletProvider>,
    );

    await flushWalletKitInit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("true");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Disconnect Wallet" }));
    });

    expect(screen.getByTestId("connected").textContent).toBe("false");
    expect(screen.getByTestId("address").textContent).toBe("none");
  });

  it("signs transactions through wallet kit", async () => {
    render(
      <WalletProvider>
        <WalletTester />
      </WalletProvider>,
    );

    await flushWalletKitInit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("connected").textContent).toBe("true");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));
    });

    await waitFor(() => {
      expect(mockKit.signTransaction).toHaveBeenCalled();
      expect(screen.getByTestId("signed").textContent).toBe("signed-xdr-value");
    });
  });

  it("maps wallet rejection to a friendly error", async () => {
    mockKit.signTransaction.mockRejectedValueOnce(new Error("User rejected request"));

    function SignTester() {
      const { connectWallet, signTransaction } = useWallet();
      const [error, setError] = React.useState("");

      return (
        <div>
          <button type="button" onClick={() => connectWallet()}>
            Connect Wallet
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await signTransaction("unsigned-xdr");
              } catch (err) {
                setError(err instanceof Error ? err.message : "unknown");
              }
            }}
          >
            Sign Transaction
          </button>
          <span data-testid="error">{error}</span>
        </div>
      );
    }

    const React = await import("react");

    render(
      <WalletProvider>
        <SignTester />
      </WalletProvider>,
    );

    await flushWalletKitInit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    });

    await waitFor(() => {
      expect(mockKit.getAddress).toHaveBeenCalled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe(
        "Transaction was rejected by wallet",
      );
    });
  });
});

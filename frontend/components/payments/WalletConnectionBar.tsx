"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/bookings";

interface WalletConnectionBarProps {
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletConnectionBar({
  walletAddress,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
}: WalletConnectionBarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-blue-50 p-2">
          <Wallet className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Stellar Wallet</p>
          {isConnected && walletAddress ? (
            <p className="font-mono text-sm text-gray-600">
              {truncateAddress(walletAddress, 5, 5)}
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Connect Freighter or Albedo to pay via escrow
            </p>
          )}
        </div>
      </div>

      {isConnected ? (
        <Button type="button" variant="outline" onClick={onDisconnect}>
          Disconnect
        </Button>
      ) : (
        <Button type="button" onClick={onConnect} disabled={isConnecting}>
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </Button>
      )}
    </div>
  );
}

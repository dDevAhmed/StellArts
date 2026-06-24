"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Price from "@/components/ui/Price";
import { api, type BookingResponse } from "@/lib/api";
import { getCounterpartyName, truncateAddress } from "@/lib/bookings";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import { CheckCircle2, XCircle } from "lucide-react";

type PaymentStep = "review" | "signing" | "submitting" | "success" | "failure";

interface PaymentModalProps {
  booking: BookingResponse | null;
  open: boolean;
  token: string;
  userRole: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({
  booking,
  open,
  token,
  userRole,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const { walletAddress, signTransaction, connectWallet, isConnected } =
    useWallet();
  const { addToast } = useToast();
  const [step, setStep] = useState<PaymentStep>("review");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<{
    transactionHash: string;
    amount: number;
    timestamp: string;
  } | null>(null);

  const resetState = () => {
    setStep("review");
    setErrorMessage("");
    setResult(null);
  };

  const handleClose = () => {
    if (step === "signing" || step === "submitting") return;
    resetState();
    onClose();
  };

  const handleContinue = async () => {
    if (!booking || !walletAddress) return;

    try {
      if (!isConnected) {
        await connectWallet();
        addToast("Connect your wallet to continue", "info");
        return;
      }

      setStep("signing");
      const amount = Number(booking.estimated_cost ?? 0);
      if (!amount || amount <= 0) {
        throw new Error("Invalid payment amount");
      }

      const prepared = await api.payments.prepare(
        {
          booking_id: booking.id,
          amount,
          client_public: walletAddress,
          asset_code: "XLM",
        },
        token,
      );

      if (!prepared.unsigned_xdr) {
        throw new Error("Invalid transaction data");
      }

      const signedXdr = await signTransaction(prepared.unsigned_xdr);

      setStep("submitting");
      const submitted = await api.payments.submit(
        { signed_xdr: signedXdr },
        token,
      );

      if (submitted.status === "error") {
        throw new Error(submitted.message || "Payment submission failed");
      }

      setResult({
        transactionHash: submitted.transaction_hash || "—",
        amount,
        timestamp: new Date().toISOString(),
      });
      setStep("success");
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Payment failed unexpectedly";

      if (message.includes("rejected by wallet")) {
        addToast("Transaction was rejected by wallet", "error");
        setStep("review");
        return;
      }

      if (
        message.toLowerCase().includes("fetch") ||
        message.toLowerCase().includes("network")
      ) {
        setErrorMessage("Unable to reach payment service");
      } else if (message.includes("Invalid transaction")) {
        setErrorMessage("Invalid transaction data");
      } else {
        setErrorMessage(message);
      }

      setStep("failure");
    }
  };

  if (!booking) return null;

  const counterparty = getCounterpartyName(booking, userRole);
  const shortId = booking.id.slice(-8).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md" data-testid="payment-modal">
        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Payment</DialogTitle>
              <DialogDescription>
                Review booking details before signing the escrow transaction.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Booking:</span> #{shortId}
              </p>
              <p>
                <span className="font-medium">Service:</span> {booking.service}
              </p>
              <p>
                <span className="font-medium">Counterparty:</span> {counterparty}
              </p>
              <p>
                <span className="font-medium">Amount:</span>{" "}
                <Price amount={Number(booking.estimated_cost ?? 0)} />
              </p>
              <p>
                <span className="font-medium">Wallet:</span>{" "}
                {walletAddress
                  ? truncateAddress(walletAddress, 6, 6)
                  : "Not connected"}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleContinue}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "signing" && (
          <div className="py-8 text-center">
            <p className="font-medium text-gray-900">Waiting for wallet signature…</p>
            <p className="mt-2 text-sm text-gray-500">
              Approve the transaction in your Stellar wallet.
            </p>
          </div>
        )}

        {step === "submitting" && (
          <div className="py-8 text-center">
            <p className="font-medium text-gray-900">Submitting payment…</p>
          </div>
        )}

        {step === "success" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                Payment Successful
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Transaction:</span>{" "}
                <span className="font-mono break-all">{result.transactionHash}</span>
              </p>
              <p>
                <span className="font-medium">Amount:</span>{" "}
                <Price amount={result.amount} />
              </p>
              <p>
                <span className="font-medium">Time:</span>{" "}
                {new Date(result.timestamp).toLocaleString()}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "failure" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" />
                Payment Failed
              </DialogTitle>
              <DialogDescription>{errorMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  setStep("review");
                }}
              >
                Retry
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

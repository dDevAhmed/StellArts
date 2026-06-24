"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WalletConnectionBar } from "@/components/payments/WalletConnectionBar";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, type BookingResponse, type PaymentRecord } from "@/lib/api";
import { normalizeBookingStatus } from "@/lib/bookings";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";

export default function DashboardPaymentsPage() {
  const { token, user } = useAuth();
  const {
    walletAddress,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
  } = useWallet();
  const { addToast } = useToast();

  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingResponse | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [bookingData, paymentData] = await Promise.all([
        api.bookings.myBookings(token),
        api.payments.myPayments(token),
      ]);
      setBookings(bookingData);
      setPayments(paymentData);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to load payments",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingPayments = useMemo(
    () =>
      bookings.filter(
        (booking) => normalizeBookingStatus(booking.status) === "confirmed",
      ),
    [bookings],
  );

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch {
      addToast("Failed to connect wallet", "error");
    }
  };

  const handlePayNow = (booking: BookingResponse) => {
    if (!isConnected) {
      addToast("Connect your wallet before paying", "warning");
      return;
    }
    setSelectedBooking(booking);
    setModalOpen(true);
  };

  const userRole = user?.role ?? "client";

  return (
    <>
      <DashboardHeader
        title="Payments"
        description="Fund escrow, release payments, and view payment history."
      />

      <WalletConnectionBar
        walletAddress={walletAddress}
        isConnected={isConnected}
        isConnecting={isConnecting}
        onConnect={handleConnect}
        onDisconnect={disconnectWallet}
      />

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Pending Payments
        </h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : userRole !== "client" ? (
          <p className="text-sm text-gray-500">
            Payment actions are available to clients with confirmed bookings.
          </p>
        ) : pendingPayments.length === 0 ? (
          <p className="text-sm text-gray-500">No pending payments.</p>
        ) : (
          <div className="space-y-4">
            {pendingPayments.map((booking) => (
              <PaymentCard
                key={booking.id}
                booking={booking}
                userRole={userRole}
                onPayNow={handlePayNow}
              />
            ))}
          </div>
        )}
      </section>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            Completed escrow transactions for your bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentHistory payments={payments} loading={loading} />
        </CardContent>
      </Card>

      {token && (
        <PaymentModal
          booking={selectedBooking}
          open={modalOpen}
          token={token}
          userRole={userRole}
          onClose={() => {
            setModalOpen(false);
            setSelectedBooking(null);
          }}
          onSuccess={loadData}
        />
      )}
    </>
  );
}

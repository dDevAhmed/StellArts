import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { PaymentHistory } from "@/components/payments/PaymentHistory";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    payments: {
      prepare: vi.fn(),
      submit: vi.fn(),
    },
  },
}));

const signTransaction = vi.fn();
const connectWallet = vi.fn();

vi.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    walletAddress: "GCLIENT1234567890123456789012345678901234567890",
    isConnected: true,
    connectWallet,
    signTransaction,
  }),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

const booking = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  client_id: 1,
  artisan_id: 2,
  artisan_name: "Jane Artisan",
  service: "Plumbing repair",
  date: "2026-03-01T10:00:00",
  estimated_cost: 100,
  estimated_hours: 2,
  status: "confirmed",
  location: null,
  notes: null,
  created_at: "2026-02-01T10:00:00",
  updated_at: null,
};

describe("Payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays booking details in payment modal", () => {
    render(
      <PaymentModal
        booking={booking}
        open
        token="token"
        userRole="client"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText(/confirm payment/i)).toBeInTheDocument();
    expect(screen.getByText(/plumbing repair/i)).toBeInTheDocument();
    expect(screen.getByText(/jane artisan/i)).toBeInTheDocument();
  });

  it("runs prepare, sign, and submit payment flow", async () => {
    vi.mocked(api.payments.prepare).mockResolvedValue({
      status: "prepared",
      unsigned_xdr: "unsigned-xdr",
      booking_id: booking.id,
      amount: "100",
    });
    signTransaction.mockResolvedValue("signed-xdr");
    vi.mocked(api.payments.submit).mockResolvedValue({
      status: "success",
      transaction_hash: "abc123hash",
    });

    render(
      <PaymentModal
        booking={booking}
        open
        token="token"
        userRole="client"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(api.payments.prepare).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: booking.id,
          client_public: expect.any(String),
        }),
        "token",
      );
    });

    await waitFor(() => {
      expect(signTransaction).toHaveBeenCalledWith("unsigned-xdr");
    });

    await waitFor(() => {
      expect(api.payments.submit).toHaveBeenCalledWith(
        { signed_xdr: "signed-xdr" },
        "token",
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/payment successful/i)).toBeInTheDocument();
    });
  });

  it("shows failure state with retry option", async () => {
    vi.mocked(api.payments.prepare).mockRejectedValue(
      new Error("Unable to reach payment service"),
    );

    render(
      <PaymentModal
        booking={booking}
        open
        token="token"
        userRole="client"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/payment failed/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders payment history rows", () => {
    render(
      <PaymentHistory
        payments={[
          {
            id: "pay-1",
            booking_id: booking.id,
            amount: 100,
            transaction_hash: "abc123def456",
            status: "held",
            asset_code: "XLM",
            created_at: "2026-01-01T00:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByText(/abc123/i)).toBeInTheDocument();
    expect(screen.getByText(/100 XLM/i)).toBeInTheDocument();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});

import type { PaymentRecord } from "@/lib/api";

interface PaymentHistoryProps {
  payments: PaymentRecord[];
  loading?: boolean;
}

function formatStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "held" || normalized === "released") return "Success";
  if (normalized === "failed") return "Failed";
  return status;
}

export function PaymentHistory({ payments, loading }: PaymentHistoryProps) {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading payment history…</p>;
  }

  if (payments.length === 0) {
    return <p className="text-sm text-gray-500">No payments yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2 font-semibold">Tx Hash</th>
            <th className="px-3 py-2 font-semibold">Amount</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr
              key={payment.id}
              className="border-b border-gray-100"
              data-testid={`payment-history-${payment.id}`}
            >
              <td className="px-3 py-3 font-mono text-xs">
                {payment.transaction_hash
                  ? `${payment.transaction_hash.slice(0, 6)}...${payment.transaction_hash.slice(-4)}`
                  : "—"}
              </td>
              <td className="px-3 py-3">
                {payment.amount} {payment.asset_code}
              </td>
              <td className="px-3 py-3">{formatStatus(payment.status)}</td>
              <td className="px-3 py-3">
                {new Date(payment.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

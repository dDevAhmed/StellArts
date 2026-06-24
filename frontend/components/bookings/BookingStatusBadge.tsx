import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/api";

const statusConfig: Record<
  BookingStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-50 text-blue-800 border-blue-200",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-purple-50 text-purple-800 border-purple-200",
  },
  completed: {
    label: "Completed",
    className: "bg-green-50 text-green-800 border-green-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-50 text-red-800 border-red-200",
  },
  disputed: {
    label: "Disputed",
    className: "bg-orange-50 text-orange-800 border-orange-200",
  },
};

interface BookingStatusBadgeProps {
  status: string;
}

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const normalized = status.toLowerCase() as BookingStatus;
  const config = statusConfig[normalized] ?? statusConfig.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

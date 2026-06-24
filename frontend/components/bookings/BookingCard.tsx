"use client";

import { Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Price from "@/components/ui/Price";
import type { BookingResponse, BookingStatus } from "@/lib/api";
import {
  getCounterpartyName,
  normalizeBookingStatus,
} from "@/lib/bookings";
import { BookingStatusBadge } from "./BookingStatusBadge";

interface BookingCardProps {
  booking: BookingResponse;
  userRole: string;
  onStatusUpdate: (bookingId: string, status: BookingStatus) => Promise<void>;
  isUpdating?: boolean;
}

function getAvailableActions(
  booking: BookingResponse,
  userRole: string,
): { label: string; status: BookingStatus; variant?: "destructive" | "default" }[] {
  const status = normalizeBookingStatus(booking.status);
  const actions: { label: string; status: BookingStatus; variant?: "destructive" | "default" }[] = [];

  if (userRole === "client") {
    if (status === "pending") {
      actions.push({ label: "Cancel", status: "cancelled", variant: "destructive" });
    }
    if (status === "in_progress") {
      actions.push({ label: "Mark Complete", status: "completed" });
    }
  }

  if (userRole === "artisan") {
    if (status === "pending") {
      actions.push({ label: "Confirm", status: "confirmed" });
    }
    if (status === "confirmed") {
      actions.push({ label: "Start", status: "in_progress" });
    }
    if (["pending", "confirmed", "in_progress"].includes(status)) {
      actions.push({ label: "Cancel", status: "cancelled", variant: "destructive" });
    }
  }

  return actions;
}

export function BookingCard({
  booking,
  userRole,
  onStatusUpdate,
  isUpdating = false,
}: BookingCardProps) {
  const counterparty = getCounterpartyName(booking, userRole);
  const actions = getAvailableActions(booking, userRole);
  const shortId = booking.id.slice(-8).toUpperCase();

  return (
    <Card data-testid={`booking-card-${booking.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">{booking.service}</CardTitle>
          <p className="text-sm text-gray-500">with {counterparty}</p>
          <p className="text-xs font-mono text-gray-400">#{shortId}</p>
        </div>
        <BookingStatusBadge status={booking.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {booking.date
              ? new Date(booking.date).toLocaleString()
              : "Date not set"}
          </span>
          <span>
            Amount:{" "}
            {booking.estimated_cost != null ? (
              <Price amount={Number(booking.estimated_cost)} />
            ) : (
              "—"
            )}
          </span>
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                size="sm"
                variant={action.variant === "destructive" ? "destructive" : "default"}
                disabled={isUpdating}
                onClick={() => onStatusUpdate(booking.id, action.status)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

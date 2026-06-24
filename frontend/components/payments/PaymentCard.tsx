"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Price from "@/components/ui/Price";
import type { BookingResponse } from "@/lib/api";
import { getCounterpartyName } from "@/lib/bookings";

interface PaymentCardProps {
  booking: BookingResponse;
  userRole: string;
  onPayNow: (booking: BookingResponse) => void;
}

export function PaymentCard({ booking, userRole, onPayNow }: PaymentCardProps) {
  const counterparty = getCounterpartyName(booking, userRole);
  const shortId = booking.id.slice(-8).toUpperCase();

  return (
    <Card data-testid={`payment-card-${booking.id}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Booking #{shortId}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
          <p>
            <span className="font-medium text-gray-900">Service:</span>{" "}
            {booking.service}
          </p>
          <p>
            <span className="font-medium text-gray-900">Counterparty:</span>{" "}
            {counterparty}
          </p>
          <p>
            <span className="font-medium text-gray-900">Amount:</span>{" "}
            {booking.estimated_cost != null ? (
              <Price amount={Number(booking.estimated_cost)} />
            ) : (
              "—"
            )}
          </p>
          <p>
            <span className="font-medium text-gray-900">Due:</span>{" "}
            {booking.date
              ? new Date(booking.date).toLocaleDateString()
              : "Not scheduled"}
          </p>
        </div>
        <Button type="button" onClick={() => onPayNow(booking)}>
          Pay Now
        </Button>
      </CardContent>
    </Card>
  );
}

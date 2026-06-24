"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BookingCard } from "@/components/bookings/BookingCard";
import { BookingFilters } from "@/components/bookings/BookingFilters";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { api, type BookingResponse, type BookingStatus } from "@/lib/api";
import { filterBookings, type BookingFilter } from "@/lib/bookings";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function DashboardBookingsPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<BookingFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.bookings.myBookings(token);
      setBookings(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load bookings",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleStatusUpdate = async (
    bookingId: string,
    status: BookingStatus,
  ) => {
    if (!token) return;

    const previous = bookings;
    setUpdatingId(bookingId);
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, status } : booking,
      ),
    );

    try {
      await api.bookings.updateStatus(bookingId, status, token);
      addToast(`Booking ${status.replace("_", " ")}`, "success");
    } catch (err) {
      setBookings(previous);
      addToast(
        err instanceof Error ? err.message : "Failed to update booking",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredBookings = filterBookings(bookings, activeFilter);
  const userRole = user?.role ?? "client";

  return (
    <>
      <DashboardHeader
        title="My Bookings"
        description="View and manage your booking requests."
      />

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 p-4 text-red-600">{error}</p>
      )}

      <BookingFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {loading ? (
        <p className="text-gray-500">Loading bookings…</p>
      ) : filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No bookings yet.{" "}
            <Link href="/artisans" className="text-blue-600 hover:underline">
              Find Artisans
            </Link>{" "}
            to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              userRole={userRole}
              onStatusUpdate={handleStatusUpdate}
              isUpdating={updatingId === booking.id}
            />
          ))}
        </div>
      )}
    </>
  );
}

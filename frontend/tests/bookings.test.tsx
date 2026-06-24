import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookingFilters } from "@/components/bookings/BookingFilters";
import { BookingCard } from "@/components/bookings/BookingCard";
import { filterBookings } from "@/lib/bookings";
import type { BookingResponse } from "@/lib/api";

const sampleBookings: BookingResponse[] = [
  {
    id: "1",
    client_id: 1,
    artisan_id: 2,
    artisan_name: "Jane Artisan",
    service: "Plumbing",
    date: "2026-03-01T10:00:00",
    estimated_cost: 100,
    estimated_hours: 2,
    status: "pending",
    location: null,
    notes: null,
    created_at: "2026-02-01T10:00:00",
    updated_at: null,
  },
  {
    id: "2",
    client_id: 1,
    artisan_id: 3,
    artisan_name: "Bob Builder",
    service: "Carpentry",
    date: "2026-03-02T10:00:00",
    estimated_cost: 200,
    estimated_hours: 3,
    status: "confirmed",
    location: null,
    notes: null,
    created_at: "2026-02-02T10:00:00",
    updated_at: null,
  },
  {
    id: "3",
    client_id: 1,
    artisan_id: 4,
    artisan_name: "Dana Designer",
    service: "Design",
    date: "2026-03-03T10:00:00",
    estimated_cost: 300,
    estimated_hours: 4,
    status: "completed",
    location: null,
    notes: null,
    created_at: "2026-02-03T10:00:00",
    updated_at: null,
  },
];

describe("Bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters bookings client-side", () => {
    expect(filterBookings(sampleBookings, "pending")).toHaveLength(1);
    expect(filterBookings(sampleBookings, "active")).toHaveLength(1);
    expect(filterBookings(sampleBookings, "completed")).toHaveLength(1);
    expect(filterBookings(sampleBookings, "all")).toHaveLength(3);
  });

  it("updates active filter tab", () => {
    const onFilterChange = vi.fn();
    render(
      <BookingFilters activeFilter="all" onFilterChange={onFilterChange} />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /pending/i }));
    expect(onFilterChange).toHaveBeenCalledWith("pending");
  });

  it("calls status update handler for client actions", async () => {
    const onStatusUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <BookingCard
        booking={sampleBookings[0]}
        userRole="client"
        onStatusUpdate={onStatusUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(onStatusUpdate).toHaveBeenCalledWith("1", "cancelled");
    });
  });

  it("shows artisan confirm action for pending bookings", () => {
    render(
      <BookingCard
        booking={sampleBookings[0]}
        userRole="artisan"
        onStatusUpdate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });

  it("optimistically reflects updated status in UI via parent state", async () => {
    let bookings = [...sampleBookings];
    const onStatusUpdate = vi.fn(async (id: string, status: string) => {
      bookings = bookings.map((booking) =>
        booking.id === id ? { ...booking, status } : booking,
      );
    });

    const { rerender } = render(
      <BookingCard
        booking={bookings[0]}
        userRole="client"
        onStatusUpdate={onStatusUpdate}
      />,
    );

    const optimisticBooking = { ...bookings[0], status: "cancelled" };
    rerender(
      <BookingCard
        booking={optimisticBooking}
        userRole="client"
        onStatusUpdate={onStatusUpdate}
      />,
    );

    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });
});

import type { BookingResponse, BookingStatus } from "./api";

export type BookingFilter = "all" | "pending" | "active" | "completed";

export function normalizeBookingStatus(status: string): BookingStatus {
  const normalized = status.toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "confirmed" ||
    normalized === "in_progress" ||
    normalized === "completed" ||
    normalized === "cancelled" ||
    normalized === "disputed"
  ) {
    return normalized;
  }
  return "pending";
}

export function getCounterpartyName(
  booking: BookingResponse,
  userRole: string | undefined,
): string {
  if (userRole === "artisan") {
    return booking.client_name || `Client #${booking.client_id}`;
  }
  return booking.artisan_name || `Artisan #${booking.artisan_id}`;
}

export function filterBookings(
  bookings: BookingResponse[],
  filter: BookingFilter,
): BookingResponse[] {
  if (filter === "all") return bookings;

  return bookings.filter((booking) => {
    const status = normalizeBookingStatus(booking.status);
    switch (filter) {
      case "pending":
        return status === "pending";
      case "active":
        return status === "confirmed" || status === "in_progress";
      case "completed":
        return status === "completed" || status === "cancelled";
      default:
        return true;
    }
  });
}

export function truncateAddress(address: string, start = 5, end = 5): string {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

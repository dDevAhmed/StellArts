"use client";

import { cn } from "@/lib/utils";
import type { BookingFilter } from "@/lib/bookings";

const filters: { id: BookingFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

interface BookingFiltersProps {
  activeFilter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
}

export function BookingFilters({
  activeFilter,
  onFilterChange,
}: BookingFiltersProps) {
  return (
    <div
      className="mb-6 flex flex-wrap gap-2"
      role="tablist"
      aria-label="Booking filters"
    >
      {filters.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={activeFilter === id}
          onClick={() => onFilterChange(id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            activeFilter === id
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

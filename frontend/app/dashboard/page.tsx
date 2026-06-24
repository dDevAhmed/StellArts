"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/dashboard");
      return;
    }

    if (user?.role === "admin") {
      router.replace("/dashboard/admin/disputes");
      return;
    }

    router.replace("/dashboard/bookings");
  }, [isAuthenticated, isLoading, user?.role, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-gray-500">Redirecting…</p>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function useRequireAuth(redirectPath: string) {
  const router = useRouter();
  const { isAuthenticated, isLoading, token, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [isAuthenticated, isLoading, redirectPath, router]);

  return { isAuthenticated, isLoading, token, user };
}

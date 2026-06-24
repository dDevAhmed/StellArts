"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from "react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Sidebar, MobileDrawer } from "./Sidebar";

interface DashboardMenuContextValue {
  openMenu: () => void;
}

const DashboardMenuContext = createContext<DashboardMenuContextValue>({
  openMenu: () => {},
});

export function useDashboardMenu() {
  return useContext(DashboardMenuContext);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useRequireAuth("/dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading dashboard…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardMenuContext.Provider value={{ openMenu: () => setMobileOpen(true) }}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="mx-auto flex max-w-7xl pt-20">
          <div className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-20 h-[calc(100vh-5rem)]">
              <Sidebar />
            </div>
          </div>

          <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

          <main className="min-w-0 flex-1 px-4 py-6 pb-16 sm:px-6 lg:px-8">
            <div data-testid="dashboard-shell">{children}</div>
          </main>
        </div>
        <Footer />
      </div>
    </DashboardMenuContext.Provider>
  );
}

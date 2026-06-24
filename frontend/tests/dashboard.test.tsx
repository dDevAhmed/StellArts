import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Sidebar } from "@/components/dashboard/Sidebar";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => "/dashboard/bookings"),
}));

vi.mock("@/components/ui/Navbar", () => ({
  default: () => <nav data-testid="navbar">Navbar</nav>,
}));

vi.mock("@/components/ui/Footer", () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

const mockUseAuth = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("Dashboard", () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      replace,
      push: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  it("redirects unauthenticated users to login", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      token: null,
      user: null,
    });

    render(
      <DashboardShell>
        <div>Protected content</div>
      </DashboardShell>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?redirect=%2Fdashboard");
    });
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("shows loading state during auth hydration", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      token: null,
      user: null,
    });

    render(
      <DashboardShell>
        <div>Protected content</div>
      </DashboardShell>,
    );

    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it("renders dashboard shell for authenticated users", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      token: "token",
      user: { role: "client", email: "client@example.com", full_name: "Client" },
    });

    render(
      <DashboardShell>
        <div>Protected content</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
  });

  it("renders role-aware sidebar navigation", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      token: "token",
      user: { role: "artisan", email: "artisan@example.com", full_name: "Artisan" },
    });

    render(<Sidebar />);

    expect(screen.getByText(/artisan/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bookings/i })).toHaveAttribute(
      "href",
      "/dashboard/bookings",
    );
    expect(screen.getByRole("link", { name: /payments/i })).toHaveAttribute(
      "href",
      "/dashboard/payments",
    );
  });
});

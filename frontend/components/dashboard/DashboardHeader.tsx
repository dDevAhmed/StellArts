"use client";

import { SidebarToggle } from "./Sidebar";
import { useDashboardMenu } from "./DashboardShell";

interface DashboardHeaderProps {
  title: string;
  description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  const { openMenu } = useDashboardMenu();

  return (
    <header className="mb-8 flex items-start gap-3">
      <SidebarToggle onClick={openMenu} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-600 sm:text-base">{description}</p>
        )}
      </div>
    </header>
  );
}

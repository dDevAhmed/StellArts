 "use client";

import { useTheme } from "@/context/ThemeProvider";
import { Moon, Sun, Monitor } from "lucide-react";

type Variant = "icon" | "full";

interface ThemeToggleProps {
  variant?: Variant;
  className?: string;
}

export function ThemeToggle({ variant = "icon", className = "" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (variant === "full") {
    return (
      <div className={`flex items-center gap-1 rounded-lg border border-border bg-muted p-1 ${className}`}>
        {(["light", "system", "dark"] as const).map((t) => {
          const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
          const label = t.charAt(0).toUpperCase() + t.slice(1);
          return (
            <button
              key={t}
              onClick={() => setTheme(t)}
              title={label}
              aria-label={`Switch to ${label} mode`}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                theme === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className={`rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className}`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
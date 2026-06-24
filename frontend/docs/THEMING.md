# Theming Guide

StellarArts uses a **CSS-variable → Tailwind token** system that makes every component automatically respond to light and dark mode without per-component logic.

---

## Architecture

```
localStorage ("stellarts-theme")
        │
        ▼
ThemeProvider  ──→  adds/removes `.dark` on <html>
        │
        ▼
CSS custom properties (:root / .dark in globals.css)
        │
        ▼
Tailwind semantic tokens (@theme block in globals.css)
        │
        ▼
Component classes  (bg-background, text-foreground, …)
```

The anti-FOUC inline script in `layout.tsx` reads `localStorage` and sets the correct class **before React hydrates**, preventing a flash of the wrong theme.

---

## Color Tokens

| Tailwind class            | CSS variable              | Purpose                                 |
|---------------------------|---------------------------|-----------------------------------------|
| `bg-background`           | `--background`            | Page / layout background                |
| `text-foreground`         | `--foreground`            | Primary body text                       |
| `bg-card`                 | `--card`                  | Card / panel surface                    |
| `text-card-foreground`    | `--card-foreground`       | Text on card surfaces                   |
| `bg-popover`              | `--popover`               | Dropdown / tooltip surface              |
| `text-popover-foreground` | `--popover-foreground`    | Text inside popovers                    |
| `bg-primary`              | `--primary`               | Primary action (buttons, links)         |
| `text-primary-foreground` | `--primary-foreground`    | Text on primary backgrounds             |
| `bg-secondary`            | `--secondary`             | Secondary action / subtle surface       |
| `text-secondary-foreground`| `--secondary-foreground` | Text on secondary backgrounds           |
| `bg-muted`                | `--muted`                 | Disabled / subdued surface              |
| `text-muted-foreground`   | `--muted-foreground`      | Subdued / helper text                   |
| `bg-accent`               | `--accent`                | Highlight / hover surface               |
| `text-accent-foreground`  | `--accent-foreground`     | Text on accented backgrounds            |
| `bg-destructive`          | `--destructive`           | Error / danger action                   |
| `text-destructive-foreground`| `--destructive-foreground`| Text on destructive backgrounds      |
| `border-border`           | `--border`                | Default borders and dividers            |
| `border-input`            | `--input`                 | Form input borders                      |
| `ring-ring`               | `--ring`                  | Focus ring color                        |

---

## How to Use in Components

### ✅ Do — use semantic tokens

```tsx
// Surface
<div className="bg-card text-card-foreground rounded-lg border border-border p-4">

// Text hierarchy
<h2 className="text-foreground font-semibold">Title</h2>
<p  className="text-muted-foreground text-sm">Subtitle</p>

// Interactive
<button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2">
  Save
</button>

// Input
<input className="border-input bg-background text-foreground rounded-md border px-3 py-2 focus:ring-2 focus:ring-ring" />
```

### ❌ Don't — hardcode colors

```tsx
// These will NOT update when the theme changes
<div className="bg-white text-black">
<p  className="text-gray-600">
<button className="bg-gray-900 text-white">
```

---

## How to Add New Tokens

1. Add the CSS variable in `globals.css` inside **both** `:root` and `.dark`:

```css
:root {
  --brand: 210 100% 50%;
}
.dark {
  --brand: 210 80% 65%;
}
```

2. Expose it in the `@theme` block:

```css
@theme {
  --color-brand: hsl(var(--brand));
}
```

3. Use it in components:

```tsx
<div className="bg-brand text-brand/80">...</div>
```

---

## ThemeProvider API

```tsx
import { useTheme } from "@/components/context/ThemeProvider";

const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

// theme         → "light" | "dark" | "system"  (user preference)
// resolvedTheme → "light" | "dark"              (actual applied theme)
// setTheme      → sets preference + persists to localStorage
// toggleTheme   → flips between light and dark
```

---

## ThemeToggle Component

```tsx
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Icon-only toggle (default)
<ThemeToggle />

// Three-way toggle with labels (light / system / dark)
<ThemeToggle variant="full" />
```

---

## Theme Persistence

| Scenario                         | Behaviour                                      |
|----------------------------------|------------------------------------------------|
| User sets theme manually         | Stored in `localStorage` as `"light"` or `"dark"` |
| No preference stored             | Follows `prefers-color-scheme` media query     |
| Page refresh                     | Reads `localStorage` before first paint (no flash) |
| Cross-route navigation           | Theme class lives on `<html>` — always present |
| System preference changes        | Respected in real-time when theme is `"system"` |

---

## Best Practices

- **Always** use semantic tokens (`bg-background`, `text-foreground`, etc.) in new components.
- Static palettes (`bg-gray-800`, `bg-blue-500`) are fine for decorative, non-theme-reactive elements (e.g. a fixed illustration accent color). Otherwise avoid.
- When you need opacity variants, use Tailwind's built-in slash syntax: `text-foreground/60`.
- Test both themes before opening a PR: toggle with `<ThemeToggle variant="full" />` in your dev environment.
- Prefer `transition-colors` on interactive elements for smooth hover/focus state changes — the global `body` transition handles page-level switches.
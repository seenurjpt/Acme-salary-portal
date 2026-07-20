"use client";

/**
 * App shell: collapsible sidebar + sticky top navbar, fully responsive.
 *
 * - Desktop (md+): sidebar toggles between full (labels) and icon-only widths;
 *   preference persisted in localStorage.
 * - Mobile: sidebar becomes an off-canvas drawer with a backdrop, opened from
 *   the hamburger in the navbar and auto-closed on navigation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "./ui";
import { AskWidget } from "./ask-widget";

const links = [
  { href: "/", label: "Dashboard", icon: ChartIcon },
  { href: "/employees", label: "Employees", icon: UsersIcon },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // desktop: icon-only mode
  const [mobileOpen, setMobileOpen] = useState(false); // mobile: drawer visibility

  // Restore the desktop collapse preference.
  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/30 transition-opacity duration-300 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-out",
          // mobile: off-canvas drawer
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          // desktop: always visible, width driven by collapse state
          "md:translate-x-0 md:shadow-none",
          collapsed ? "md:w-16" : "md:w-60",
        )}
      >
        {/* Brand */}
        <div className={cn("flex h-14 items-center border-b border-slate-100 px-4", collapsed && "md:justify-center md:px-0")}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            A
          </span>
          <span className={cn("ml-2.5 truncate text-sm font-semibold text-slate-900", collapsed && "md:hidden")}>
            ACME · Salaries
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 px-2.5 py-4">
          {links.map((l) => {
            const active = isActive(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                title={l.label}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "md:justify-center md:px-0",
                )}
              >
                <Icon />
                <span className={cn("ml-3 truncate", collapsed && "md:hidden")}>{l.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden border-t border-slate-100 p-2.5 md:block">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-50 hover:text-slate-700",
              collapsed && "justify-center px-0",
            )}
          >
            <ChevronIcon flipped={collapsed} />
            <span className={cn("ml-3", collapsed && "hidden")}>Collapse</span>
          </button>
        </div>
      </aside>

      {/* Main column, shifted right of the sidebar on desktop */}
      <div className={cn("flex min-h-screen flex-col transition-all duration-300 ease-out", collapsed ? "md:pl-16" : "md:pl-60")}>
        {/* Top navbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <span className="text-sm font-medium text-slate-700">
            {links.find((l) => isActive(l.href))?.label ?? "ACME · Salaries"}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:block">hr@acme.com</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      <AskWidget />
    </div>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M4 20V10M10 20V4M16 20v-7M20 20H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path
        d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M14 7a4 4 0 11-8 0 4 4 0 018 0zM21 21v-2a4 4 0 00-3-3.87M16.5 3.13a4 4 0 010 7.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cn("shrink-0 transition-transform duration-300", flipped && "rotate-180")}
    >
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

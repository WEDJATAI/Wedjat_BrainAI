"use client";

import * as React from "react";
import { Github, Activity, ShieldCheck, Sun, Moon } from "lucide-react";
import { BrainWidget } from "@/components/brain/brain-widget";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { CirkleMark } from "@/components/brand/cirkle-mark";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Layer 1 — Aurora mesh gradient (fixed, behind everything) */}
      <div
        className="aurora-bg pointer-events-none fixed inset-0 -z-20 opacity-90"
        aria-hidden
      />
      {/* Layer 2 — Subtle arabesque gold-dot pattern overlay */}
      <div
        className="arabesque pointer-events-none fixed inset-0 -z-10 opacity-[0.07]"
        aria-hidden
      />
      {/* Layer 3 — Subtle gold grid (kept from the original shell) */}
      <div
        className="cirkle-grid-bg pointer-events-none fixed inset-0 -z-10 opacity-30"
        aria-hidden
      />

      <Header />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-3 sm:px-4 sm:py-4">
        {/* Premium glass-strong main shell with ring-glow halo */}
        <div className="glass-strong ring-glow relative rounded-2xl p-2 shadow-glass sm:rounded-[28px] sm:p-3">
          <BrainWidget />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="gold-edge-bottom sticky top-0 z-40 border-b border-[hsl(var(--gold)/0.18)] bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          {/* Cirkle mark — three interlocking circles, rotates 360° in 30s.
              Wrapped in animate-blur-in for a premium mount. */}
          <div className="relative flex h-9 w-9 animate-blur-in items-center justify-center sm:h-10 sm:w-10">
            <CirkleMark
              size={36}
              className="drop-shadow-[0_0_8px_rgba(194,160,96,0.5)] sm:hidden"
            />
            <CirkleMark
              size={40}
              className="hidden drop-shadow-[0_0_10px_rgba(194,160,96,0.55)] sm:block"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-sm font-semibold tracking-tight sm:text-base">
              <span className="cirkle-text-glow text-foreground">Cirkle</span>{" "}
              <span className="text-muted-foreground">BRAIN</span>
            </h1>
            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              Cognitive Operating Layer
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Premium badge — gold-stroke chip with a signal-dot (mesh state)
              instead of the old plain pulse dot. */}
          <span className="gold-stroke hover-lift-glow hidden gap-1.5 text-[10px] font-medium md:inline-flex">
            <span
              className="signal-dot"
              data-state="mesh"
              style={{ width: 6, height: 6 } as React.CSSProperties}
              aria-hidden
            />
            <span className="text-foreground/90">Acme · Mashahd</span>
          </span>
          <ThemeToggle />
          <a
            href="https://chat.z.ai"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:block"
          >
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Github className="h-3.5 w-3.5" /> Spec
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light" : "Switch to dark"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[color:var(--color-cirkle-cyan)]" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

function Footer() {
  return (
    <footer className="gold-edge-top mt-auto border-t border-[hsl(var(--gold)/0.18)] bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center justify-between gap-3 px-3 text-[11px] text-muted-foreground sm:px-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="signal-dot"
              data-state="mesh"
              style={{ width: 6, height: 6 } as React.CSSProperties}
              aria-label="Mesh network active"
            />
            <span className="text-foreground/80">Tenant isolation</span>
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Activity className="h-3 w-3 text-[color:var(--color-cirkle-cyan)]" />
            <span>Brain owns cognition, model is replaceable</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Authorization outside the model</span>
          <span className="font-mono text-[color:var(--color-cirkle-cyan)]">
            Cirkle Brain AI
          </span>
        </div>
      </div>
    </footer>
  );
}

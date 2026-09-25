"use client";

import * as React from "react";
import { Brain, Github, Activity, ShieldCheck, Sun, Moon } from "lucide-react";
import { BrainWidget } from "@/components/brain/brain-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { CirkleMark } from "@/components/brand/cirkle-mark";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Subtle gold circuit-grid backdrop (matches Cirkle logo aesthetic) */}
      <div className="pointer-events-none fixed inset-0 -z-10 cirkle-grid-bg opacity-40" aria-hidden />
      <Header />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 py-3 sm:px-4 sm:py-4">
        <BrainWidget />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          {/* Cirkle mark — three interlocking circles, rotates 360° in 30s */}
          <div className="relative flex h-9 w-9 items-center justify-center">
            <CirkleMark size={36} className="drop-shadow-[0_0_8px_rgba(194,160,96,0.45)]" />
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
          <Badge variant="outline" className="hidden gap-1 text-[10px] md:inline-flex">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[color:var(--color-cirkle-cyan)] cirkle-pulse" />
            Acme · Mashahd
          </Badge>
          <ThemeToggle />
          <a href="https://chat.z.ai" target="_blank" rel="noreferrer" className="hidden sm:block">
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
    >
      {isDark ? <Sun className="h-4 w-4 text-[color:var(--color-cirkle-cyan)]" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center justify-between gap-3 px-3 text-[11px] text-muted-foreground sm:px-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[color:var(--color-cirkle-cyan)]" />
            Tenant isolation
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Activity className="h-3 w-3 text-[color:var(--color-cirkle-cyan)]" />
            Brain owns cognition, model is replaceable
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Authorization outside the model</span>
          <span className="font-mono text-[color:var(--color-cirkle-cyan)]">Cirkle Brain AI</span>
        </div>
      </div>
    </footer>
  );
}

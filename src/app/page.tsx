"use client";

import * as React from "react";
import { Brain, Github, Activity, ShieldCheck } from "lucide-react";
import { BrainWidget } from "@/components/brain/brain-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/30">
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
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Brain className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-semibold tracking-tight sm:text-base">WEDJAT BRAIN</h1>
            <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">V2 · model-independent cognitive layer</Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="hidden gap-1 text-[10px] md:inline-flex">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Acme · Mashahd
          </Badge>
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

function Footer() {
  return (
    <footer className="mt-auto border-t bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center justify-between gap-3 px-3 text-[11px] text-muted-foreground sm:px-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-600" /> Tenant isolation · §62</span>
          <span className="hidden items-center gap-1 sm:flex"><Activity className="h-3 w-3 text-emerald-600" /> Brain owns cognition, model is replaceable · §2</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Authorization outside the model · §4 R3</span>
          <span className="font-mono">v0.1.0</span>
        </div>
      </div>
    </footer>
  );
}

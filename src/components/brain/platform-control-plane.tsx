"use client";

import * as React from "react";
import { Network, Activity, Shield, Wrench, Radio, ExternalLink, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Play, Lock, Globe, Building2, Scale, DollarSign, Mail, Film, ShoppingCart, FileCheck, Users, Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { apiGet, apiPost } from "@/lib/brain/client";
import { toast } from "sonner";

interface PlatformRow {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  domain: string;
  description: string;
  repoUrl?: string;
  productionUrl?: string;
  adapterStatus: string;
  adapterVersion?: string;
  sdkVersion?: string;
  knowledgeScope: string;
  memoryScope: string;
  toolScope: string;
  dataClassCeiling: string;
  modelPolicy: string;
  riskCeiling: string;
  allowedBrainScopes: string[];
  capabilities: string[];
  eventTypes: string[];
  domainTools: string[];
  personality?: { tone: string; vocabulary: string[]; systemPromptSuffix: string };
  status: string;
  runtimeAdapterLoaded: boolean;
  linkedApplicationIds: string[];
  lastHeartbeatAt?: string;
  lastEventAt?: string;
  requestCount: number;
  errorCount: number;
  costUsdTotal: number;
}

interface AcceptanceResult {
  scenario: string;
  status: string;
  detail?: { spec?: string; honestDisclaimer?: string; steps?: string[]; assertions?: Array<{ name: string; passed: boolean; expected?: string; actual?: string; note?: string }>; evidence?: unknown };
  runId?: string;
  startedAt?: string;
  completedAt?: string;
}

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  social: <Users className="h-3.5 w-3.5" />,
  mail: <Mail className="h-3.5 w-3.5" />,
  media: <Film className="h-3.5 w-3.5" />,
  verification: <FileCheck className="h-3.5 w-3.5" />,
  agreements: <CheckCircle2 className="h-3.5 w-3.5" />,
  business: <Building2 className="h-3.5 w-3.5" />,
  trade: <ShoppingCart className="h-3.5 w-3.5" />,
  finance: <DollarSign className="h-3.5 w-3.5" />,
  justice: <Scale className="h-3.5 w-3.5" />,
  compliance: <Shield className="h-3.5 w-3.5" />,
};

export function PlatformControlPlane() {
  const [platforms, setPlatforms] = React.useState<PlatformRow[]>([]);
  const [summary, setSummary] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(true);
  const [expandedSlug, setExpandedSlug] = React.useState<string | null>(null);
  const [acceptanceRunning, setAcceptanceRunning] = React.useState(false);
  const [acceptanceResults, setAcceptanceResults] = React.useState<AcceptanceResult[] | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ platforms: PlatformRow[]; summary: Record<string, unknown> }>("/api/brain/platforms");
      setPlatforms(d.platforms);
      setSummary(d.summary);
    } catch (e: any) {
      toast.error(e?.message ?? "failed to load platforms");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function runAcceptance() {
    setAcceptanceRunning(true);
    setAcceptanceResults(null);
    try {
      const r = await apiPost<AcceptanceResult | { results: AcceptanceResult[] }>("/api/brain/acceptance", { scenario: "all" });
      const list = Array.isArray(r) ? r : ("results" in r ? r.results : [r]);
      setAcceptanceResults(list);
      const passed = list.filter((x) => x.status === "PASSED").length;
      toast.success(`Acceptance suite: ${passed}/${list.length} scenarios passed`);
    } catch (e: any) {
      toast.error(e?.message ?? "acceptance failed");
    } finally {
      setAcceptanceRunning(false);
    }
  }

  async function togglePlatform(slug: string, currentStatus: string) {
    const next = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await fetch(`/api/brain/platforms/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reason: `admin toggle to ${next}` }),
      });
      toast.success(`${slug} → ${next}`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "toggle failed");
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="Platforms" value={(summary.total as number) ?? 0} />
        <Stat label="Active" value={(summary.active as number) ?? 0} tone="ok" />
        <Stat label="Audited" value={(summary.audited as number) ?? 0} tone="info" />
        <Stat label="Adapters" value={(summary.adaptersLoaded as number) ?? 0} tone="info" />
      </div>

      {/* Acceptance suite runner */}
      <Card className="border-[color:var(--color-cirkle-cyan)]/20">
        <CardHeader className="pb-2 pt-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-1.5 text-xs"><Shield className="h-3.5 w-3.5 text-[color:var(--color-cirkle-cyan)]" /> Cross-Platform Acceptance</CardTitle>
            <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px]" onClick={runAcceptance} disabled={acceptanceRunning}>
              {acceptanceRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Run all
            </Button>
          </div>
        </CardHeader>
        {acceptanceResults && (
          <CardContent className="pt-0 pb-2">
            <div className="space-y-1">
              {acceptanceResults.map((r) => (
                <div key={r.scenario} className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1 text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.status === "PASSED" ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> : r.status === "FAILED" ? <XCircle className="h-3 w-3 text-rose-500 shrink-0" /> : <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                    <span className="truncate font-mono">{r.scenario}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] shrink-0", r.status === "PASSED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : r.status === "FAILED" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300")}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Platform list */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="pb-2 pt-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-1.5 text-xs"><Network className="h-3.5 w-3.5 text-[color:var(--color-cirkle-cyan)]" /> Connected Platforms</CardTitle>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={load} disabled={loading}><RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /></Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2 h-full">
          <ScrollArea className="h-[calc(100%-2rem)] max-h-[520px]">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1">
                {platforms.map((p) => (
                  <PlatformRow key={p.id} p={p} expanded={expandedSlug === p.slug} onToggle={() => setExpandedSlug(expandedSlug === p.slug ? null : p.slug)} onDisable={() => togglePlatform(p.slug, p.status)} />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformRow({ p, expanded, onToggle, onDisable }: { p: PlatformRow; expanded: boolean; onToggle: () => void; onDisable: () => void }) {
  const statusTone = p.status === "ACTIVE" ? "ok" : p.status === "DISABLED" ? "err" : "warn";
  const adapterTone = p.adapterStatus === "AUDITED" ? "ok" : p.adapterStatus === "REGISTERED" ? "info" : "warn";
  return (
    <div className={cn("rounded-lg border bg-card transition-colors", expanded && "ring-1 ring-[color:var(--color-cirkle-cyan)]/30")}>
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-accent/50">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-cirkle-cyan)]/10 text-[color:var(--color-cirkle-cyan)]">
          {DOMAIN_ICONS[p.domain] ?? <Boxes className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold">{p.displayName}</span>
            <Badge variant="outline" className="text-[9px] shrink-0">{p.domain}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <span className={cn("flex items-center gap-0.5", statusTone === "ok" ? "text-emerald-600" : statusTone === "err" ? "text-rose-600" : "text-amber-600")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", statusTone === "ok" ? "bg-emerald-500" : statusTone === "err" ? "bg-rose-500" : "bg-amber-500")} />
              {p.status}
            </span>
            <span>·</span>
            <span>{p.adapterStatus}</span>
            {p.runtimeAdapterLoaded && <span className="text-[color:var(--color-cirkle-cyan)]">· adapter ✓</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <RiskBadge risk={p.riskCeiling} />
          <ClassBadge cls={p.dataClassCeiling} />
        </div>
      </button>
      {expanded && (
        <div className="border-t bg-muted/20 px-2.5 py-2 text-[10px]">
          <p className="mb-1.5 text-muted-foreground">{p.description}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Model policy" value={p.modelPolicy} />
            <Field label="Knowledge scope" value={p.knowledgeScope} icon={p.knowledgeScope === "PRIVATE" ? <Lock className="h-2.5 w-2.5" /> : p.knowledgeScope === "GLOBAL_VERIFIED" ? <Globe className="h-2.5 w-2.5" /> : undefined} />
            <Field label="Memory scope" value={p.memoryScope} />
            <Field label="Tool scope" value={p.toolScope} />
          </div>
          <div className="mt-1.5">
            <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">Capabilities ({p.capabilities.length})</p>
            <div className="flex flex-wrap gap-0.5">
              {p.capabilities.map((c) => <Badge key={c} variant="outline" className="text-[8px]">{c}</Badge>)}
            </div>
          </div>
          <div className="mt-1.5">
            <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">Domain tools ({p.domainTools.length})</p>
            <div className="flex flex-wrap gap-0.5">
              {p.domainTools.map((t) => <Badge key={t} variant="outline" className="text-[8px] font-mono">{t}</Badge>)}
            </div>
          </div>
          <div className="mt-1.5">
            <p className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">Event types ({p.eventTypes.length})</p>
            <div className="flex flex-wrap gap-0.5">
              {p.eventTypes.slice(0, 4).map((e) => <Badge key={e} variant="outline" className="text-[8px] font-mono">{e}</Badge>)}
              {p.eventTypes.length > 4 && <span className="text-[8px] text-muted-foreground">+{p.eventTypes.length - 4} more</span>}
            </div>
          </div>
          {(p.repoUrl || p.productionUrl) && (
            <div className="mt-1.5 flex items-center gap-2">
              {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-[9px] text-[color:var(--color-cirkle-cyan)] hover:underline"><ExternalLink className="h-2.5 w-2.5" /> repo</a>}
              {p.productionUrl && <a href={p.productionUrl} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-[9px] text-[color:var(--color-cirkle-cyan)] hover:underline"><ExternalLink className="h-2.5 w-2.5" /> prod</a>}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">requests: {p.requestCount} · errors: {p.errorCount} · cost: ${p.costUsdTotal.toFixed(4)}</span>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[9px]" onClick={onDisable}>
              {p.status === "ACTIVE" ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "info" | "warn" }) {
  return (
    <div className={cn("rounded-md border p-1.5 text-center",
      tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : tone === "info" ? "border-[color:var(--color-cirkle-cyan)]/30 bg-[color:var(--color-cirkle-cyan)]/5" : "border-border bg-muted/30")}>
      <p className={cn("text-base font-bold leading-tight", tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : tone === "info" ? "text-[color:var(--color-cirkle-cyan)]" : "")}>{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded border bg-background/50 px-1.5 py-1">
      <p className="text-[8px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1 text-[10px] font-medium">{icon}{value}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const tone = risk === "CRITICAL" || risk === "HIGH" ? "err" : risk === "MEDIUM" ? "warn" : "ok";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("text-[8px]", tone === "err" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" : tone === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
            <Shield className="h-2 w-2" /> {risk}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Risk ceiling</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ClassBadge({ cls }: { cls: string }) {
  const tone = cls === "RESTRICTED" ? "err" : cls === "CONFIDENTIAL" ? "warn" : "ok";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("text-[8px]", tone === "err" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" : tone === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
            {cls}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Data classification ceiling</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

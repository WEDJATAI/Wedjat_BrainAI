"use client";

import * as React from "react";
import { Heart, Gauge, ScrollText, Layers, BookOpen, Brain, Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, Trash2, ArrowUpCircle, Network } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiGet, apiPost } from "@/lib/brain/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PlatformControlPlane } from "./platform-control-plane";

export function AdminConsole() {
  return (
    <Tabs defaultValue="platforms" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-2 grid grid-cols-4">
        <TabsTrigger value="platforms" className="text-xs"><Network className="mr-1 h-3 w-3" /> Platforms</TabsTrigger>
        <TabsTrigger value="health" className="text-xs"><Heart className="mr-1 h-3 w-3" /> Health</TabsTrigger>
        <TabsTrigger value="metrics" className="text-xs"><Gauge className="mr-1 h-3 w-3" /> Metrics</TabsTrigger>
        <TabsTrigger value="audit" className="text-xs"><ScrollText className="mr-1 h-3 w-3" /> Audit</TabsTrigger>
      </TabsList>
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          <TabsContent value="platforms" className="mt-0">
            <PlatformControlPlane />
          </TabsContent>
          <TabsContent value="health" className="mt-0 space-y-3">
            <HealthPanel />
            <CapabilitiesPanel />
          </TabsContent>
          <TabsContent value="metrics" className="mt-0 space-y-3">
            <MetricsPanel />
            <CandidatesPanel />
          </TabsContent>
          <TabsContent value="audit" className="mt-0 space-y-3">
            <AuditPanel />
            <KnowledgePanel />
            <MemoryAdminPanel />
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
function useFetch<T>(path: string, deps: any[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiGet<T>(path)); } catch (e: any) { setError(e?.message ?? "failed"); }
    finally { setLoading(false); }
  }, [path]);
  React.useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

function HealthPanel() {
  const { data, loading, reload } = useFetch<any>("/api/brain/health");
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm"><Heart className="h-4 w-4 text-rose-500" /> Self-Diagnostics</CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={reload} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {loading ? <Loading /> : data ? (
          <>
            <div className="flex items-center gap-2">
              <Badge className={cn(data.state === "HEALTHY" ? "border-[color:var(--color-wedjat-cyan)]/30 bg-[color:var(--color-wedjat-cyan)]/10 text-[color:var(--color-wedjat-cyan-deep)] dark:text-[color:var(--color-wedjat-glow)]" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300")}>{data.state}</Badge>
              <span className="text-[10px] text-muted-foreground">{data.latencyMs}ms</span>
            </div>
            <div className="space-y-1">
              {Object.entries(data.checks).map(([k, v]: any) => (
                <div key={k} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {v.ok ? <CheckCircle2 className="h-3 w-3 text-[color:var(--color-wedjat-cyan)]" /> : <XCircle className="h-3 w-3 text-rose-500" />}
                    <span className="font-medium">{k}</span>
                  </div>
                  <span className="truncate text-[10px] text-muted-foreground" title={v.detail}>{v.detail}</span>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-xs text-muted-foreground">Failed to load.</p>}
      </CardContent>
    </Card>
  );
}

function CapabilitiesPanel() {
  const { data, loading } = useFetch<any>("/api/brain/capabilities");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Layers className="h-4 w-4 text-[color:var(--color-wedjat-cyan)]" /> Capabilities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading || !data ? <Loading /> : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(data.counts).map(([k, v]: any) => (
                <div key={k} className="rounded-md border bg-muted/30 p-1.5 text-center">
                  <p className="text-sm font-bold">{v}</p>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {data.domains.map((d: string) => <Badge key={d} variant="outline" className="text-[9px]">{d}</Badge>)}
            </div>
            <details className="text-[10px]">
              <summary className="cursor-pointer text-muted-foreground">Endpoints ({data.endpoints.length})</summary>
              <pre className="mt-1 overflow-auto rounded bg-muted/40 p-2 text-[9px] font-mono">{data.endpoints.join("\n")}</pre>
            </details>
            <details className="text-[10px]">
              <summary className="cursor-pointer text-muted-foreground">Constitutional principles</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-muted-foreground">
                {data.principles.map((p: string) => <li key={p}>{p}</li>)}
              </ul>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricsPanel() {
  const { data, loading, reload } = useFetch<any>("/api/brain/metrics");
  const [running, setRunning] = React.useState(false);
  async function runEval() {
    setRunning(true);
    try {
      const r = await apiPost<any>("/api/brain/evaluate", {});
      toast.success(`Evaluation: ${r.pass}/${r.total} passed (${(r.passRate * 100).toFixed(0)}%)`);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "eval failed"); }
    finally { setRunning(false); }
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm"><Gauge className="h-4 w-4 text-[color:var(--color-wedjat-cyan)]" /> Observability</CardTitle>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={runEval} disabled={running}>
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run golden eval
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading || !data ? <Loading /> : (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <Metric label="Runs" value={data.totals.runs} />
              <Metric label="Model calls" value={data.totals.modelCalls} />
              <Metric label="Tool calls" value={data.totals.toolExecutions} />
              <Metric label="Audit events" value={data.totals.auditEvents} />
              <Metric label="p50 / p95" value={`${data.latency.p50}/${data.latency.p95}ms`} />
              <Metric label="Fallback rate" value={`${(data.totals.fallbackRate * 100).toFixed(0)}%`} />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">By model</p>
              <div className="space-y-1">
                {Object.entries(data.byModel).length === 0 ? <p className="text-[10px] text-muted-foreground">No model calls yet.</p> :
                  Object.entries(data.byModel).map(([k, v]: any) => (
                    <div key={k} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono">{k}</span>
                      <span className="text-muted-foreground">{v.calls} calls · {v.fallbacks} fallbacks</span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">By tool</p>
              <div className="space-y-1">
                {Object.entries(data.byTool).length === 0 ? <p className="text-[10px] text-muted-foreground">No tool calls yet.</p> :
                  Object.entries(data.byTool).map(([k, v]: any) => (
                    <div key={k} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono">{k}</span>
                      <span className="text-muted-foreground">{v.verified}/{v.total} verified · {v.failed} failed</span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Recent runs</p>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {data.recentRuns.length === 0 ? <p className="text-[10px] text-muted-foreground">No runs yet.</p> :
                    data.recentRuns.map((r: any) => (
                      <div key={r.requestId} className="rounded border bg-muted/30 p-1.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{r.requestId.slice(0, 8)}</span>
                          <Badge variant="outline" className="text-[9px]">{r.status}</Badge>
                        </div>
                        <div className="mt-0.5 text-muted-foreground">{r.modelUsed} · {r.latencyMs}ms · ${r.costUsd.toFixed(4)} · ev={r.evidenceCount}</div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AuditPanel() {
  const { data, loading, reload } = useFetch<any>("/api/brain/audit?limit=50");
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm"><ScrollText className="h-4 w-4 text-[color:var(--color-wedjat-cyan)]" /> Audit Log</CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={reload} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading || !data ? <Loading /> : (
          <ScrollArea className="max-h-96">
            <div className="space-y-1">
              {data.events.length === 0 ? <p className="text-xs text-muted-foreground">No audit events yet.</p> :
                data.events.map((e: any) => (
                  <div key={e.id} className="rounded border bg-muted/30 p-1.5 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{e.action}</span>
                      <Badge variant="outline" className={cn("text-[9px]",
                        e.severity === "CRITICAL" || e.severity === "ERROR" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" :
                        e.severity === "WARN" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" :
                        "border-border bg-muted text-muted-foreground")}>{e.severity}</Badge>
                    </div>
                    {e.reason && <p className="mt-0.5 text-muted-foreground">{e.reason}</p>}
                    <div className="mt-0.5 flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{e.actorType}:{e.actorId}</span>
                      <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function CandidatesPanel() {
  const { data, loading, reload } = useFetch<any>("/api/brain/candidates");
  async function decide(id: string, decision: "PROMOTED" | "REJECTED") {
    try {
      await apiPost("/api/brain/candidates", { id, decision });
      toast.success(`Candidate ${decision.toLowerCase()}`);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "failed"); }
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /> Learning Candidates</CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={reload} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading || !data ? <Loading /> : (
          <div className="space-y-1.5">
            {data.candidates.length === 0 ? <p className="text-xs text-muted-foreground">No candidates yet — send a message to generate one.</p> :
              data.candidates.slice(0, 10).map((c: any) => (
                <div key={c.id} className="rounded border bg-muted/30 p-1.5 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[9px]">{c.category}</Badge>
                    <Badge variant="outline" className={cn("text-[9px]", c.decision === "PENDING" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-border bg-muted")}>{c.decision}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-muted-foreground" title={c.proposed}>{c.proposed?.slice(0, 100)}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">novelty={c.noveltyScore?.toFixed(2)} conflict={String(c.conflictDetected)}</span>
                    {c.decision === "PENDING" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[9px]" onClick={() => decide(c.id, "PROMOTED")}><ArrowUpCircle className="h-3 w-3" /> Promote</Button>
                        <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[9px]" onClick={() => decide(c.id, "REJECTED")}><Trash2 className="h-3 w-3" /> Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KnowledgePanel() {
  const { data, loading, reload } = useFetch<any>("/api/brain/knowledge");
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4 text-[color:var(--color-wedjat-cyan)]" /> Knowledge</CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={reload} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading || !data ? <Loading /> : (
          <ScrollArea className="max-h-96">
            <div className="space-y-1.5">
              {data.items.length === 0 ? <p className="text-xs text-muted-foreground">No knowledge items.</p> :
                data.items.map((k: any) => (
                  <div key={k.id} className="rounded border bg-muted/30 p-1.5 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[9px]">{k.type}</Badge>
                      <Badge variant="outline" className="text-[9px]">{k.status}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2">{k.claim}</p>
                    {k.source && <p className="mt-0.5 text-[9px] text-muted-foreground">src: {k.source.title}</p>}
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function MemoryAdminPanel() {
  const { data, loading, reload } = useFetch<any>("/api/brain/memory");
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm"><Brain className="h-4 w-4 text-[color:var(--color-wedjat-cyan)]" /> Memory</CardTitle>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={reload} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading || !data ? <Loading /> : (
          <ScrollArea className="max-h-96">
            <div className="space-y-1.5">
              {data.memories.length === 0 ? <p className="text-xs text-muted-foreground">No memories.</p> :
                data.memories.map((m: any) => (
                  <div key={m.id} className="rounded border bg-muted/30 p-1.5 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[9px]">{m.domain}/{m.type}</Badge>
                      <Badge variant="outline" className="text-[9px]">{m.status}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2">{m.content}</p>
                    <div className="mt-0.5 flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>{m.scope} · v{m.version}</span>
                      <span>conf={m.confidence?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-1.5">
      <p className="text-sm font-bold leading-tight">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
}

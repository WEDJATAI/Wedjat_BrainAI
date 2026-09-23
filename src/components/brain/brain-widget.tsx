"use client";

import * as React from "react";
import Image from "next/image";
import { Send, Loader2, ShieldCheck, AlertTriangle, Database, Cpu, Wrench, Activity, GitBranch, ChevronRight, CircleDot, CheckCircle2, XCircle, Clock, DollarSign, Zap, Layers, FileText, Network, Globe, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { streamBrainResponse, apiGet, apiPost, type BrainStreamState, initialStreamState } from "@/lib/brain/client";
import type { BrainMode, EvidenceStatus, ToolResult, TraceStep } from "@/lib/brain/types";
import { AdminConsole } from "./admin-console";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  state?: BrainStreamState;
  question?: string; // the user's question that prompted this assistant message
  createdAt: number;
}

const MODES: { value: BrainMode; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Brain decides" },
  { value: "fast", label: "Fast", hint: "Fast tier" },
  { value: "balanced", label: "Balanced", hint: "Balanced tier" },
  { value: "deep", label: "Deep", hint: "Reasoning tier" },
];

const SAMPLE_PROMPTS = [
  "What does the Wedjat Brain spec say about authorization?",
  "What is invoice 1827?",
  "Add 23 and 19",
  "Why is the model not the Brain?",
  "Send an email to alice@example.com about the invoice",
  "What is the weather in Dubai?",
];

export function BrainWidget() {
  const [mode, setMode] = React.useState<BrainMode>("auto");
  const [platformSlug, setPlatformSlug] = React.useState<string>("mashahd");
  const [platforms, setPlatforms] = React.useState<Array<{ slug: string; displayName: string; domain: string; status: string }>>([]);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [activeMessageId, setActiveMessageId] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    apiGet<{ platforms: Array<{ slug: string; displayName: string; domain: string; status: string }> }>("/api/brain/platforms")
      .then((d) => setPlatforms(d.platforms.filter((p) => p.status === "ACTIVE")))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeMessageId]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content, createdAt: Date.now() };
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", state: initialStreamState(), question: content, createdAt: Date.now() };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setActiveMessageId(assistantMsg.id);
    setStreaming(true);
    abortRef.current = new AbortController();
    try {
      await streamBrainResponse(
        { input: { text: content }, mode, platformSlug },
        (state) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: state.tokens || (state.error ? `⚠️ ${state.error.message}` : ""), state: { ...state } } : m)));
        },
        abortRef.current.signal,
      );
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: `⚠️ Stream failed: ${err?.message ?? err}` } : m)));
    } finally {
      setStreaming(false);
      // Keep activeMessageId pointing at the last assistant message so the
      // trace / evidence / tools / memory panels stay populated.
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Left: chat */}
      <Card className="flex h-[calc(100vh-9.5rem)] flex-col overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg wedjat-gradient text-white shadow-sm wedjat-glow">
                <Image src="/wedjat-logo.png" alt="WEDJAT" width={28} height={28} priority className="h-7 w-7 object-contain drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[color:var(--color-wedjat-cyan)] ring-2 ring-background">
                  <span className="h-1.5 w-1.5 wedjat-pulse rounded-full bg-[color:var(--color-wedjat-cyan-deep)]" />
                </span>
              </div>
              <div>
                <CardTitle className="text-base leading-tight">WEDJAT BRAIN</CardTitle>
                <CardDescription className="text-[11px] leading-tight">Cognitive operating layer · model-independent</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <PlatformSelector value={platformSlug} onChange={setPlatformSlug} platforms={platforms} disabled={streaming} />
              <ModeSelector value={mode} onChange={setMode} disabled={streaming} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div ref={scrollRef} className="h-full overflow-y-auto p-4">
            {messages.length === 0 ? (
              <EmptyState onPick={(p) => send(p)} />
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <ChatBubble key={m.id} message={m} active={m.id === activeMessageId} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask the Brain…  (Enter to send, Shift+Enter for newline)"
              className="min-h-[44px] max-h-40 resize-none"
              disabled={streaming}
            />
            {streaming ? (
              <Button variant="outline" size="icon" onClick={stop} className="h-11 w-11 shrink-0" title="Stop">
                <XCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={() => send()} disabled={!input.trim()} className="h-11 w-11 shrink-0 wedjat-gradient hover:opacity-90 wedjat-glow" title="Send">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Middle: cognitive trace */}
      <CognitiveTrace messages={messages} activeId={activeMessageId} />

      {/* Right: admin console (capabilities/health/metrics/audit/memory/knowledge/candidates) */}
      <Card className="hidden h-[calc(100vh-9.5rem)] flex-col overflow-hidden xl:flex">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Network className="h-4 w-4" /> Admin Console</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <AdminConsole />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode selector
// ---------------------------------------------------------------------------
function PlatformSelector({ value, onChange, platforms, disabled }: { value: string; onChange: (s: string) => void; platforms: Array<{ slug: string; displayName: string; domain: string; status: string }>; disabled: boolean }) {
  const current = platforms.find((p) => p.slug === value);
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || platforms.length === 0}>
      <SelectTrigger className="h-8 w-[150px] gap-1 border-[color:var(--color-wedjat-cyan)]/30 text-xs" size="sm">
        <Globe className="h-3 w-3 text-[color:var(--color-wedjat-cyan)]" />
        <SelectValue placeholder="Platform">
          {current ? current.displayName : value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {platforms.map((p) => (
          <SelectItem key={p.slug} value={p.slug} className="text-xs">
            <span className="font-medium">{p.displayName}</span>
            <span className="ml-1 text-[10px] text-muted-foreground">· {p.domain}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModeSelector({ value, onChange, disabled }: { value: BrainMode; onChange: (m: BrainMode) => void; disabled: boolean }) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5">
        {MODES.map((m) => (
          <Tooltip key={m.value}>
            <TooltipTrigger asChild>
              <button
                disabled={disabled}
                onClick={() => onChange(m.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  value === m.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{m.hint}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Empty state with sample prompts
// ---------------------------------------------------------------------------
function EmptyState({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl wedjat-gradient-soft ring-1 ring-[color:var(--color-wedjat-cyan)]/30">
        <Image src="/wedjat-logo.png" alt="WEDJAT Eye of Horus" width={56} height={56} priority className="h-14 w-14 object-contain drop-shadow-[0_0_10px_rgba(0,217,255,0.5)]" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Wedjat Brain</h3>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
          A model-independent cognitive layer. Identity, memory, knowledge, evidence, retrieval, tools, policy, verification, learning, observability — all owned by the Brain, not the model.
        </p>
      </div>
      <div className="grid w-full max-w-md grid-cols-1 gap-1.5">
        {SAMPLE_PROMPTS.map((p) => (
          <button key={p} onClick={() => onPick(p)} className="group flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <ChevronRight className="h-3 w-3 text-[color:var(--color-wedjat-cyan)]" />
            <span className="flex-1">{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------
function ChatBubble({ message, active }: { message: ChatMessage; active: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm wedjat-gradient px-3 py-2 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }
  const state = message.state;
  const streaming = active && !state?.done;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg wedjat-gradient-soft ring-1 ring-[color:var(--color-wedjat-cyan)]/30">
          <Image src="/wedjat-logo.png" alt="" width={20} height={20} aria-hidden className="h-5 w-5 object-contain" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {message.content ? (
            <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border bg-card px-3 py-2 text-sm leading-relaxed">
              {message.content}
              {streaming && <span className="ml-0.5 inline-block h-3.5 w-1 wedjat-pulse bg-[color:var(--color-wedjat-cyan)] align-middle" />}
            </div>
          ) : streaming ? (
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--color-wedjat-cyan)]" />
              <span>Brain is thinking…</span>
            </div>
          ) : null}
          {state && !streaming && <ResponseChips state={state} />}
          {state && !streaming && state.response && (
            <FeedbackButtons
              requestId={state.response.requestId}
              answer={message.content}
              question={message.question}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackButtons({ requestId, answer, question }: { requestId: string; answer: string; question?: string }) {
  const [given, setGiven] = React.useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function sendFeedback(signal: "thumbs_up" | "thumbs_down") {
    if (given || loading) return;
    setLoading(true);
    setGiven(signal);
    try {
      await apiPost("/api/brain/feedback", {
        requestId, signal, answer: answer.slice(0, 500), question: question?.slice(0, 500),
      });
    } catch {
      // revert on failure
      setGiven(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => sendFeedback("thumbs_up")}
        disabled={!!given || loading}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md border text-[10px] transition-colors",
          given === "thumbs_up"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        title="Good answer"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => sendFeedback("thumbs_down")}
        disabled={!!given || loading}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md border text-[10px] transition-colors",
          given === "thumbs_down"
            ? "border-rose-500/40 bg-rose-500/15 text-rose-600"
            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        title="Bad answer"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
      {given && (
        <span className="text-[10px] text-muted-foreground">
          {given === "thumbs_up" ? "Thanks — helps the Brain learn" : "Thanks — Brain will investigate"}
        </span>
      )}
    </div>
  );
}

function ResponseChips({ state }: { state: BrainStreamState }) {
  const chips: React.ReactNode[] = [];
  if (state.model) {
    chips.push(
      <Chip key="model" icon={<Cpu className="h-3 w-3" />} label={`${state.model.model}${state.model.fallbackUsed ? " (fallback)" : ""}`} tone={state.model.fallbackUsed ? "warn" : "ok"} />
    );
  }
  if (state.research) {
    chips.push(<Chip key="research" icon={<Globe className="h-3 w-3" />} label={`web: ${state.research.ingestedCount} learned`} tone="info" />);
  }
  if (state.verification) {
    chips.push(<Chip key="ver" icon={<ShieldCheck className="h-3 w-3" />} label={state.verification.status} tone={verificationTone(state.verification.status)} />);
  }
  if (state.tools.length > 0) {
    chips.push(<Chip key="tools" icon={<Wrench className="h-3 w-3" />} label={`${state.tools.length} tool`} tone="ok" />);
  }
  if (state.evidence.length > 0) {
    chips.push(<Chip key="ev" icon={<FileText className="h-3 w-3" />} label={`${state.evidence.length} evidence`} tone="ok" />);
  }
  if (state.cost) {
    chips.push(<Chip key="cost" icon={<Zap className="h-3 w-3" />} label={`${state.cost.latencyMs}ms`} tone="muted" />);
    if (state.cost.costUsd > 0) chips.push(<Chip key="cost2" icon={<DollarSign className="h-3 w-3" />} label={`$${state.cost.costUsd.toFixed(4)}`} tone="muted" />);
  }
  if (chips.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-1">{chips}</div>;
}

function Chip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "ok" | "warn" | "err" | "muted" | "info" }) {
  const cls = {
    ok: "border-[color:var(--color-wedjat-cyan)]/30 bg-[color:var(--color-wedjat-cyan)]/10 text-[color:var(--color-wedjat-cyan-deep)] dark:text-[color:var(--color-wedjat-glow)]",
    info: "border-[color:var(--color-wedjat-cyan)]/40 bg-[color:var(--color-wedjat-cyan)]/15 text-[color:var(--color-wedjat-cyan-deep)] dark:text-[color:var(--color-wedjat-glow)]",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    err: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    muted: "border-border bg-muted text-muted-foreground",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", cls)}>
      {icon}
      {label}
    </span>
  );
}

function verificationTone(s: EvidenceStatus): "ok" | "warn" | "err" | "muted" {
  if (s === "VERIFIED") return "ok";
  if (s === "SUPPORTED") return "ok";
  if (s === "INFERRED") return "warn";
  if (s === "UNCERTAIN") return "warn";
  if (s === "CONFLICTED") return "warn";
  if (s === "UNSUPPORTED" || s === "UNKNOWN") return "err";
  return "muted";
}

// ---------------------------------------------------------------------------
// Cognitive trace (middle column) — shows the trace + evidence + tools for
// the active (most recent assistant) message.
// ---------------------------------------------------------------------------
function CognitiveTrace({ messages, activeId }: { messages: ChatMessage[]; activeId: string | null }) {
  const active = messages.find((m) => m.id === activeId && m.role === "assistant");
  const state = active?.state;
  return (
    <Card className="hidden h-[calc(100vh-9.5rem)] flex-col overflow-hidden lg:flex">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-[color:var(--color-wedjat-cyan)]" /> Cognitive Trace</CardTitle>
        <CardDescription className="text-[11px]">Real-time execution path — no private hidden reasoning exposed</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs defaultValue="trace" className="flex h-full flex-col">
          <TabsList className="mx-3 mt-2 grid grid-cols-5">
            <TabsTrigger value="trace" className="text-xs">Trace</TabsTrigger>
            <TabsTrigger value="evidence" className="text-xs">Evidence</TabsTrigger>
            <TabsTrigger value="research" className="text-xs">Research</TabsTrigger>
            <TabsTrigger value="tools" className="text-xs">Tools</TabsTrigger>
            <TabsTrigger value="memory" className="text-xs">Memory</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <div className="p-3">
              {!state ? (
                <div className="flex h-full items-center justify-center py-10 text-center text-xs text-muted-foreground">
                  Send a message to see the Brain's cognitive trace.
                </div>
              ) : (
                <>
                  <TabsContent value="trace" className="mt-0">
                    <TraceList steps={state.trace} />
                  </TabsContent>
                  <TabsContent value="evidence" className="mt-0">
                    <EvidenceList state={state} />
                  </TabsContent>
                  <TabsContent value="research" className="mt-0">
                    <ResearchList state={state} />
                  </TabsContent>
                  <TabsContent value="tools" className="mt-0">
                    <ToolsList state={state} />
                  </TabsContent>
                  <TabsContent value="memory" className="mt-0">
                    <MemoryList state={state} />
                  </TabsContent>
                </>
              )}
            </div>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TraceList({ steps }: { steps: TraceStep[] }) {
  if (steps.length === 0) return <EmptyHint icon={<Activity className="h-4 w-4" />} text="Trace will appear here as the Brain executes." />;
  return (
    <ol className="relative space-y-1 border-l border-dashed border-border pl-4">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span className={cn("absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
            s.status === "COMPLETED" ? "bg-[color:var(--color-wedjat-cyan)]" : s.status === "FAILED" ? "bg-rose-500" : s.status === "SKIPPED" ? "bg-muted-foreground" : "bg-amber-500 animate-pulse")}>
            {s.status === "COMPLETED" ? <CheckCircle2 className="h-2.5 w-2.5 text-white" /> : s.status === "FAILED" ? <XCircle className="h-2.5 w-2.5 text-white" /> : <CircleDot className="h-2 w-2 text-white" />}
          </span>
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium leading-tight">{s.stepName}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.stepType}</p>
            </div>
            {s.durationMs !== undefined && <Badge variant="outline" className="shrink-0 text-[9px] font-mono">{s.durationMs}ms</Badge>}
          </div>
          {s.reasonCode && <p className="mt-0.5 text-[10px] text-muted-foreground">↳ {s.reasonCode}</p>}
        </li>
      ))}
    </ol>
  );
}

function EvidenceList({ state }: { state: BrainStreamState }) {
  if (state.evidence.length === 0) return <EmptyHint icon={<FileText className="h-4 w-4" />} text="No evidence retrieved. Try asking about the Wedjat Brain spec or invoice 1827." />;
  return (
    <div className="space-y-2">
      {state.evidence.map((e) => (
        <div key={e.id} className="rounded-lg border bg-card p-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[9px]">{e.type}</Badge>
            <Badge variant="outline" className={cn("text-[9px]", verificationToneClass(e.evidenceStatus))}>{e.evidenceStatus}</Badge>
          </div>
          <p className="text-xs leading-snug">{e.claim}</p>
          {e.sourceTitle && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <GitBranch className="h-2.5 w-2.5" /> {e.sourceTitle}
              {e.conflict && <span className="text-amber-600"> · ⚠ conflict</span>}
            </p>
          )}
          {(e.validFrom || e.validUntil) && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              <Clock className="inline h-2.5 w-2.5" /> {e.validFrom ? `from ${e.validFrom.slice(0, 10)}` : ""} {e.validUntil ? `until ${e.validUntil.slice(0, 10)}` : ""}
            </p>
          )}
        </div>
      ))}
      <p className="pt-1 text-[10px] text-muted-foreground">Lineage: answer → claim → evidence → source.</p>
    </div>
  );
}

function ToolsList({ state }: { state: BrainStreamState }) {
  if (state.tools.length === 0) return <EmptyHint icon={<Wrench className="h-4 w-4" />} text="No tools invoked. Try 'add 23 and 19' or 'send an email'." />;
  return (
    <div className="space-y-2">
      {state.tools.map((t, i) => (
        <ToolCard key={i} tool={t} />
      ))}
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolResult }) {
  const [approving, setApproving] = React.useState(false);
  const [current, setCurrent] = React.useState(tool);
  React.useEffect(() => { setCurrent(tool); }, [tool]);
  async function approve() {
    setApproving(true);
    try {
      const r = await apiPost<{ result: ToolResult }>("/api/brain/tools/approve", { executionId: current.executionId, approver: "alice@acme.test" });
      setCurrent(r.result);
      toast.success(`Approved ${current.toolId} → ${r.result.state}`);
    } catch (e: any) {
      toast.error(e?.message ?? "approval failed");
    } finally {
      setApproving(false);
    }
  }
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3 w-3 text-[color:var(--color-wedjat-cyan)]" />
          <span className="text-xs font-medium">{current.toolId}</span>
        </div>
        <Badge variant="outline" className={cn("text-[9px]", actionStateClass(current.state))}>{current.state}</Badge>
      </div>
      {current.output && (
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-[10px] font-mono leading-tight">{JSON.stringify(current.output, null, 2)}</pre>
      )}
      {current.error && <p className="mt-1 text-[10px] text-rose-600">{current.error}</p>}
      {current.requiresApproval && !current.approved && current.state === "AUTHORIZED" && (
        <Button size="sm" className="mt-2 h-7 w-full text-xs" onClick={approve} disabled={approving}>
          {approving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
          Approve (human authorization)
        </Button>
      )}
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{current.durationMs}ms</span>
        <span>governed execution</span>
      </div>
    </div>
  );
}

function ResearchList({ state }: { state: BrainStreamState }) {
  if (!state.research || state.research.resultsCount === 0) {
    return <EmptyHint icon={<Globe className="h-4 w-4" />} text="No web research triggered for this request. The Brain only searches the web when local knowledge is insufficient." />;
  }
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-[color:var(--color-wedjat-cyan)]/30 bg-[color:var(--color-wedjat-cyan)]/5 p-2.5">
        <p className="text-xs font-medium text-[color:var(--color-wedjat-cyan-deep)] dark:text-[color:var(--color-wedjat-glow)]">Web research triggered</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Query: "{state.research.query}"</p>
        <p className="text-[10px] text-muted-foreground">{state.research.resultsCount} results · {state.research.ingestedCount} new facts ingested as knowledge</p>
      </div>
      <div className="space-y-1.5">
        {state.research.sources.map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block rounded-lg border bg-card p-2 hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 shrink-0 text-[color:var(--color-wedjat-cyan)]" />
              <span className="truncate text-xs font-medium">{s.title}</span>
            </div>
            <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{s.url}</p>
          </a>
        ))}
      </div>
      <p className="pt-1 text-[10px] text-muted-foreground">Auto-learned: these web results are now stored as knowledge for future questions.</p>
    </div>
  );
}

function MemoryList({ state }: { state: BrainStreamState }) {
  if (state.memory.length === 0) return <EmptyHint icon={<Database className="h-4 w-4" />} text="No memories recalled for this request." />;
  return (
    <div className="space-y-2">
      {state.memory.map((m) => (
        <div key={m.id} className="rounded-lg border bg-card p-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[9px]">{m.type}</Badge>
            <Badge variant="outline" className="text-[9px]">{m.scope}</Badge>
          </div>
          <p className="text-xs leading-snug">{m.content}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-muted-foreground">
      <div className="rounded-full border bg-muted/30 p-2">{icon}</div>
      <p className="max-w-xs">{text}</p>
    </div>
  );
}

function verificationToneClass(s: EvidenceStatus) {
  if (s === "VERIFIED" || s === "SUPPORTED") return "border-[color:var(--color-wedjat-cyan)]/30 bg-[color:var(--color-wedjat-cyan)]/10 text-[color:var(--color-wedjat-cyan-deep)] dark:text-[color:var(--color-wedjat-glow)]";
  if (s === "INFERRED" || s === "UNCERTAIN" || s === "CONFLICTED") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

function actionStateClass(s: string) {
  if (s === "VERIFIED" || s === "EXECUTED") return "border-[color:var(--color-wedjat-cyan)]/30 bg-[color:var(--color-wedjat-cyan)]/10 text-[color:var(--color-wedjat-cyan-deep)] dark:text-[color:var(--color-wedjat-glow)]";
  if (s === "AUTHORIZED") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (s === "FAILED" || s === "TIMED_OUT" || s === "REJECTED") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "border-border bg-muted text-muted-foreground";
}

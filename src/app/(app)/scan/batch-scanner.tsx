"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  Layers,
  Loader2,
  Play,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Square,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Scanner } from "@/components/shared/scanner";
import { cn } from "@/lib/utils";

import { batchScanGarmentAction, fetchBatchExpectedGarmentsAction } from "./batch-actions";
import type { BatchScanItemResult, ExpectedGarment } from "@/lib/services/batch-scanning";

// Web Audio API Sound Synthesizer for instant audible feedback on shop floor
function playAudioFeedback(type: "MATCHED" | "MISMATCH" | "DUPLICATE" | "UNKNOWN") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === "MATCHED") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "DUPLICATE") {
      const now = ctx.currentTime;
      [now, now + 0.1].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, t); // D5
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
      });
    } else {
      // MISMATCH or UNKNOWN: Low double error tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime); // Low A3
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Audio context play error swallowed if blocked by browser autoplay policy
  }
}

export function BatchScanner() {
  const [active, setActive] = useState(false);
  const [operation, setOperation] = useState<string>("PACKING");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [expectedCountInput, setExpectedCountInput] = useState<string>("50");
  const [contextOrderNumber, setContextOrderNumber] = useState<string>("");
  const [contextOrderId, setContextOrderId] = useState<string | null>(null);

  const [scans, setScans] = useState<BatchScanItemResult[]>([]);
  const [expectedList, setExpectedList] = useState<ExpectedGarment[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [inputVal, setInputVal] = useState("");
  const [pending, startTransition] = useTransition();

  const [finished, setFinished] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<"ALL" | "MISMATCHES" | "MISSING">("ALL");

  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanTimeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  // Auto-focus maintenance for physical USB/Bluetooth barcode guns
  useEffect(() => {
    if (!active || finished) return;
    const timer = setInterval(() => {
      if (document.activeElement !== inputRef.current && inputRef.current) {
        // Only refocus if not interacting with another input
        const tag = document.activeElement?.tagName.toLowerCase();
        if (tag !== "input" && tag !== "select" && tag !== "textarea") {
          inputRef.current.focus();
        }
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [active, finished]);

  // Keep input focused when starting batch
  const handleStartBatch = () => {
    setActive(true);
    setFinished(false);
    setScans([]);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const processScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || pending || !active) return;

      // 1.5s client-side cooldown to prevent accidental multi-trigger by hardware guns
      const now = Date.now();
      if (
        lastScanTimeRef.current.code === code.toUpperCase() &&
        now - lastScanTimeRef.current.time < 1500
      ) {
        return;
      }
      lastScanTimeRef.current = { code: code.toUpperCase(), time: now };

      setInputVal("");

      const alreadyCodes = scans.map((s) => s.garmentCode).filter((c): c is string => Boolean(c));

      startTransition(async () => {
        const res = await batchScanGarmentAction({
          code,
          operation: operation === "NONE" ? null : operation,
          contextOrderId: contextOrderId ?? undefined,
          autoAdvance,
          alreadyScannedCodes: alreadyCodes,
        });

        if (res.ok) {
          const item = res.data;
          setScans((prev) => [item, ...prev]);

          if (soundEnabled) {
            playAudioFeedback(item.outcome);
          }

          if (item.outcome === "MATCHED") {
            toast.success(item.message, { duration: 1500 });
          } else if (item.outcome === "DUPLICATE") {
            toast.info(item.message, { duration: 2000 });
          } else if (item.outcome === "MISMATCH") {
            toast.error(`MISMATCH: ${item.message}`, { duration: 3000 });
          } else {
            toast.error(item.message, { duration: 3000 });
          }
        } else {
          toast.error(res.error);
        }

        // Re-focus input for continuous scanning
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    },
    [active, autoAdvance, contextOrderId, operation, pending, scans, soundEnabled],
  );

  const handleFinishBatch = () => {
    setActive(false);
    setFinished(true);
  };

  // Metrics computation
  const expectedNum = parseInt(expectedCountInput, 10) || 0;
  const scannedNum = scans.length;
  const matchedNum = scans.filter((s) => s.outcome === "MATCHED").length;
  const mismatchNum = scans.filter((s) => s.outcome === "MISMATCH").length;
  const duplicateNum = scans.filter((s) => s.outcome === "DUPLICATE").length;
  const unknownNum = scans.filter((s) => s.outcome === "UNKNOWN").length;

  const remainingNum = Math.max(0, expectedNum ? expectedNum - matchedNum : 0);

  // Missing garments computation if expected list loaded or expectedNum set
  const scannedGarmentIds = new Set(
    scans.filter((s) => s.outcome === "MATCHED" && s.garmentId).map((s) => s.garmentId!),
  );
  const missingItems = expectedList.filter((item) => !scannedGarmentIds.has(item.garmentId));

  return (
    <div className="space-y-6">
      {/* Configuration & Batch Control Bar */}
      <Card className="border-primary/30 bg-gradient-to-r from-card via-card to-primary/5">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">BATCH SCANNER</CardTitle>
              <p className="text-xs text-muted-foreground">
                Continuous high-speed garment verification & status processing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Audio tones enabled" : "Audio muted"}
              className="gap-1.5"
            >
              {soundEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-muted-foreground" />}
              {soundEnabled ? "Sound ON" : "Sound OFF"}
            </Button>

            {!active ? (
              <Button size="lg" className="gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700" onClick={handleStartBatch}>
                <Play className="size-4 fill-white" /> Start Batch
              </Button>
            ) : (
              <Button size="lg" variant="destructive" className="gap-2 font-semibold" onClick={handleFinishBatch}>
                <Square className="size-4 fill-white" /> Finish Batch
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Batch Operation</Label>
              <Select value={operation} onValueChange={setOperation} disabled={active}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select Operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">General Verification (No Stage Advance)</SelectItem>
                  <SelectItem value="RECEIVING">Receiving Batch</SelectItem>
                  <SelectItem value="WASHING">Washing Batch</SelectItem>
                  <SelectItem value="DRYING">Drying Batch</SelectItem>
                  <SelectItem value="IRONING">Ironing Batch</SelectItem>
                  <SelectItem value="PACKING">Packing Batch</SelectItem>
                  <SelectItem value="READY">Ready Batch</SelectItem>
                  <SelectItem value="DELIVERY_PREP">Delivery Preparation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Expected Garments</Label>
              <Input
                type="number"
                min="0"
                value={expectedCountInput}
                onChange={(e) => setExpectedCountInput(e.target.value)}
                placeholder="50"
                className="h-9 font-mono"
                disabled={active}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Order Context (Optional)</Label>
              <Input
                value={contextOrderNumber}
                onChange={(e) => setContextOrderNumber(e.target.value)}
                placeholder="e.g. ORD-1024"
                className="h-9 font-mono uppercase"
                disabled={active}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Auto Stage Advance</Label>
                <p className="text-[11px] text-muted-foreground">Update garment stage on match</p>
              </div>
              <Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} disabled={active} />
            </div>
          </div>

          {active && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
              </span>
              SCANNING ACTIVE — Point hardware barcode gun or camera scanner continuously
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operational Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-3.5 text-center">
            <span className="text-xs font-medium uppercase text-muted-foreground">Expected</span>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">{expectedNum}</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-3.5 text-center">
            <span className="text-xs font-medium uppercase text-muted-foreground">Scanned</span>
            <p className="mt-1 text-2xl font-bold font-mono text-foreground">{scannedNum}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-3.5 text-center">
            <span className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">Matched</span>
            <p className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{matchedNum}</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-3.5 text-center">
            <span className="text-xs font-semibold uppercase text-rose-600 dark:text-rose-400">Mismatch</span>
            <p className="mt-1 text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{mismatchNum + unknownNum}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3.5 text-center">
            <span className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">Duplicate</span>
            <p className="mt-1 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{duplicateNum}</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-3.5 text-center">
            <span className="text-xs font-medium uppercase text-muted-foreground">Remaining</span>
            <p className="mt-1 text-2xl font-bold font-mono text-muted-foreground">{remainingNum}</p>
          </CardContent>
        </Card>
      </div>

      {/* Hardware Scanner Field & Camera Scanner */}
      {active && (
        <Card className="border-2 border-dashed border-primary/40 bg-card">
          <CardContent className="space-y-4 pt-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void processScan(inputVal);
              }}
              className="flex items-center gap-3"
            >
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Continuous barcode / QR scan input (TR-1024-01 + ENTER)…"
                  className="h-14 font-mono text-lg uppercase tracking-wider pr-12 border-primary/50 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                  autoFocus
                  disabled={pending}
                />
                {pending && (
                  <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-primary" />
                )}
              </div>
              <Button type="submit" size="lg" className="h-14 px-6 font-semibold" disabled={pending || !inputVal.trim()}>
                Submit Scan
              </Button>
            </form>

            <div className="rounded-lg bg-muted/50 p-3">
              <Scanner
                variant="compact"
                placeholder="Alternative: Scan using device camera..."
                onScan={(code) => processScan(code)}
                debounceMs={1200}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Scanned List */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ScanLine className="size-4 text-primary" /> Live Scanned Garments ({scans.length})
          </CardTitle>
          {scans.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setScans([])} disabled={active} className="text-xs text-muted-foreground">
              Clear List
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ScanLine className="size-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">No garments scanned in this batch session yet.</p>
              <p className="text-xs text-muted-foreground/70">Click &quot;Start Batch&quot; above and start scanning tags.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all gap-2",
                    scan.outcome === "MATCHED" && "border-emerald-500/30 bg-emerald-500/5",
                    scan.outcome === "MISMATCH" && "border-rose-500/40 bg-rose-500/10",
                    scan.outcome === "DUPLICATE" && "border-amber-500/30 bg-amber-500/5",
                    scan.outcome === "UNKNOWN" && "border-rose-500/40 bg-rose-500/10",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {scan.outcome === "MATCHED" && (
                      <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    {scan.outcome === "MISMATCH" && (
                      <AlertTriangle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    {scan.outcome === "DUPLICATE" && (
                      <RotateCcw className="size-5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    {scan.outcome === "UNKNOWN" && (
                      <XCircle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">
                          {scan.garmentCode ?? scan.rawCode}
                        </span>
                        {scan.customerName && (
                          <span className="text-sm font-medium text-foreground">
                            — {scan.customerName}
                          </span>
                        )}
                        {scan.categoryLabel && (
                          <Badge tone="outline" className="text-[11px] font-normal">
                            {scan.categoryEmoji} {scan.categoryLabel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {scan.detail || scan.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs shrink-0 self-end sm:self-auto">
                    {scan.outcome === "MATCHED" && (
                      <Badge tone="success">✓ MATCHED</Badge>
                    )}
                    {scan.outcome === "MISMATCH" && (
                      <Badge tone="danger">⚠ MISMATCH</Badge>
                    )}
                    {scan.outcome === "DUPLICATE" && (
                      <Badge tone="warning">↻ DUPLICATE</Badge>
                    )}
                    {scan.outcome === "UNKNOWN" && (
                      <Badge tone="danger">✕ UNKNOWN GARMENT</Badge>
                    )}
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {new Date(scan.scannedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Completion Reconciliation Modal */}
      <Dialog open={finished} onOpenChange={setFinished}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" /> BATCH COMPLETE
            </DialogTitle>
            <DialogDescription>
              Reconciliation summary for completed batch session
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 my-2">
            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <div className="p-3 rounded-lg border bg-muted/20 text-center">
                <span className="text-[11px] uppercase font-semibold text-muted-foreground">Expected</span>
                <p className="text-xl font-bold font-mono">{expectedNum}</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20 text-center">
                <span className="text-[11px] uppercase font-semibold text-muted-foreground">Scanned</span>
                <p className="text-xl font-bold font-mono">{scannedNum}</p>
              </div>
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-center">
                <span className="text-[11px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">Matched</span>
                <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{matchedNum}</p>
              </div>
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-center">
                <span className="text-[11px] uppercase font-semibold text-rose-600 dark:text-rose-400">Mismatch</span>
                <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{mismatchNum + unknownNum}</p>
              </div>
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-center">
                <span className="text-[11px] uppercase font-semibold text-amber-600 dark:text-amber-400">Duplicate</span>
                <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{duplicateNum}</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20 text-center">
                <span className="text-[11px] uppercase font-semibold text-muted-foreground">Missing</span>
                <p className="text-xl font-bold font-mono text-rose-500">{remainingNum}</p>
              </div>
            </div>

            {/* Reconciliation Filter Tabs */}
            <div className="flex items-center gap-2 border-b pb-2">
              <Button
                size="sm"
                variant={summaryFilter === "ALL" ? "default" : "outline"}
                onClick={() => setSummaryFilter("ALL")}
              >
                VIEW ALL SCANS ({scans.length})
              </Button>
              <Button
                size="sm"
                variant={summaryFilter === "MISMATCHES" ? "default" : "outline"}
                onClick={() => setSummaryFilter("MISMATCHES")}
                className={cn(mismatchNum + unknownNum > 0 && "text-rose-500 border-rose-300")}
              >
                VIEW MISMATCHES ({mismatchNum + unknownNum})
              </Button>
              <Button
                size="sm"
                variant={summaryFilter === "MISSING" ? "default" : "outline"}
                onClick={() => setSummaryFilter("MISSING")}
                className={cn(remainingNum > 0 && "text-amber-500 border-amber-300")}
              >
                VIEW MISSING ({remainingNum})
              </Button>
            </div>

            {/* Detailed Filtered Table */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 border rounded-lg p-2">
              {summaryFilter === "ALL" && scans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <span className="font-mono font-bold">{scan.garmentCode ?? scan.rawCode} — {scan.customerName || "Unknown"}</span>
                  <Badge tone={scan.outcome === "MATCHED" ? "success" : "danger"}>{scan.outcome}</Badge>
                </div>
              ))}

              {summaryFilter === "MISMATCHES" && (
                scans.filter((s) => s.outcome === "MISMATCH" || s.outcome === "UNKNOWN").length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No mismatches detected in this batch.</p>
                ) : (
                  scans.filter((s) => s.outcome === "MISMATCH" || s.outcome === "UNKNOWN").map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between text-xs p-2 rounded bg-rose-500/10 border border-rose-500/20">
                      <div>
                        <span className="font-mono font-bold">{scan.garmentCode ?? scan.rawCode}</span>
                        <p className="text-rose-600 dark:text-rose-400">{scan.detail || scan.message}</p>
                      </div>
                      <Badge tone="danger">{scan.outcome}</Badge>
                    </div>
                  ))
                )
              )}

              {summaryFilter === "MISSING" && (
                remainingNum === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">All expected garments were successfully scanned.</p>
                ) : (
                  <div className="p-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded">
                    <p className="font-semibold">{remainingNum} expected garments were not scanned in this batch.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Note: Missing garments remain in their current system status and are NOT automatically deleted or marked delivered.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setFinished(false);
                setScans([]);
              }}
            >
              Close
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
              onClick={() => {
                setFinished(false);
                setScans([]);
                handleStartBatch();
              }}
            >
              START NEW BATCH
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

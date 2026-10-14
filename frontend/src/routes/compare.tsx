import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { compareContracts } from "@/lib/api";
import type { ClauseDiffItem, ContractDiffResponse } from "@/lib/schemas";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  GitCompare,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SAMPLE_V1 = `1. TERM AND TERMINATION
The Lease shall commence on 1st November 2026 for 11 months. Either Landlord or Tenant may terminate this Agreement by providing 30 days prior written notice without penalty.

2. SECURITY DEPOSIT
The Tenant shall pay a refundable security deposit of INR 1,50,000. The deposit shall be refunded within 14 days of peaceful handover of premises, subject to deduction of actual pending electricity charges.

3. MAINTENANCE AND REPAIRS
The Tenant shall bear routine minor maintenance under INR 1,000. Major structural repairs, seepage, and external plumbing remain the sole responsibility of the Landlord.`;

const SAMPLE_V2 = `1. TERM AND TERMINATION
The Lease shall commence on 1st November 2026 for 11 months. The Landlord may terminate this Agreement at any time with 7 days notice. The Tenant is locked in for the entire 11 months and cannot terminate prior to expiry.

2. SECURITY DEPOSIT
The Tenant shall pay a deposit of INR 1,50,000. In case of any dispute or early vacancy by Tenant, the entire security deposit shall stand forfeited unconditionally as liquidated damages.

3. MAINTENANCE AND REPAIRS
The Tenant shall be solely responsible for all maintenance, repairs, painting, civil defects, and damages whatsoever, irrespective of whether the defect is structural or pre-existing.`;

export default function ComparePage() {
  const [originalText, setOriginalText] = useState("");
  const [revisedText, setRevisedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContractDiffResponse | null>(null);
  const [filter, setFilter] = useState<"all" | "sneaky" | "modified" | "added">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleLoadSample = () => {
    setOriginalText(SAMPLE_V1);
    setRevisedText(SAMPLE_V2);
    setResult(null);
    toast.info("Sample contract drafts loaded for comparison.");
  };

  const handleReset = () => {
    setOriginalText("");
    setRevisedText("");
    setResult(null);
  };

  const handleCompare = async () => {
    if (originalText.trim().length < 50 || revisedText.trim().length < 50) {
      toast.error("Both contract drafts must have at least 50 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await compareContracts({
        original_text: originalText,
        revised_text: revisedText,
        jurisdiction: "IN-MH",
      });
      setResult(response);
      toast.success("Draft comparison complete!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Comparison failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Recommendation copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredChanges = (result?.changes ?? []).filter((item) => {
    if (filter === "sneaky") return item.is_sneaky_risk;
    if (filter === "modified") return item.change_type === "modified";
    if (filter === "added") return item.change_type === "added";
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2 text-center"
      >
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GitCompare className="h-5 w-5" />
        </div>
        <h1 className="font-bold text-3xl tracking-tight sm:text-4xl">
          Contract Version Diff & Trap Detector
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-muted-foreground text-sm">
          Compare your original contract against the counterparty's revised draft. Instantly catch
          sneaky additions, stealth indemnity shifts, shortened notice windows, and penalty traps.
        </p>
      </motion.section>

      {/* Inputs Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-semibold text-base">Original Draft (V1)</CardTitle>
              <Badge variant="outline" className="text-xs">
                Your Baseline
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-2">
            <Textarea
              placeholder="Paste original contract text here..."
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              className="min-h-[220px] flex-1 font-mono text-xs leading-relaxed"
            />
            <div className="text-right text-muted-foreground text-xs">
              {originalText.length} characters
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-semibold text-base">
                Counterparty Revised Draft (V2)
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Draft to Verify
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-2">
            <Textarea
              placeholder="Paste counterparty revised contract text here..."
              value={revisedText}
              onChange={(e) => setRevisedText(e.target.value)}
              className="min-h-[220px] flex-1 font-mono text-xs leading-relaxed"
            />
            <div className="text-right text-muted-foreground text-xs">
              {revisedText.length} characters
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleLoadSample} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Load Sample Rental Revision
          </Button>
          {(originalText || revisedText || result) && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        <Button
          onClick={handleCompare}
          disabled={loading || originalText.length < 50 || revisedText.length < 50}
          className="gap-2"
        >
          {loading ? (
            <>Analyzing Changes & Traps...</>
          ) : (
            <>
              <GitCompare className="h-4 w-4" />
              Detect Sneaky Changes
            </>
          )}
        </Button>
      </div>

      {/* Comparison Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 pt-4"
        >
          {/* Executive Verdict Banner */}
          <Card
            className={
              result.risk_verdict === "more_risky"
                ? "border-destructive/40 bg-destructive/5"
                : result.risk_verdict === "safer"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border bg-card"
            }
          >
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {result.risk_verdict === "more_risky" && (
                      <Badge
                        variant="destructive"
                        className="gap-1 px-2.5 py-0.5 text-xs font-semibold"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        HIGH TRAP RISK DETECTED
                      </Badge>
                    )}
                    {result.risk_verdict === "safer" && (
                      <Badge className="gap-1 bg-emerald-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        SAFER OR BALANCED DRAFT
                      </Badge>
                    )}
                    {result.risk_verdict === "neutral" && (
                      <Badge
                        variant="secondary"
                        className="gap-1 px-2.5 py-0.5 text-xs font-semibold"
                      >
                        NEUTRAL CHANGES
                      </Badge>
                    )}
                    <span className="font-semibold text-sm">
                      {result.changes.length} Total Changes · {result.sneaky_traps_count} Sneaky
                      Traps
                    </span>
                  </div>
                  <p className="text-foreground/90 text-sm">{result.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="text-xs"
            >
              All Changes ({result.changes.length})
            </Button>
            <Button
              variant={filter === "sneaky" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setFilter("sneaky")}
              className="gap-1 text-xs"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Sneaky Traps Only ({result.sneaky_traps_count})
            </Button>
            <Button
              variant={filter === "modified" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilter("modified")}
              className="text-xs"
            >
              Modified
            </Button>
            <Button
              variant={filter === "added" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilter("added")}
              className="text-xs"
            >
              Added
            </Button>
          </div>

          {/* Changes Feed */}
          <div className="space-y-4">
            {filteredChanges.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
                No changes match the selected filter.
              </div>
            ) : (
              filteredChanges.map((change: ClauseDiffItem, idx: number) => {
                const changeKey = `change-${idx}-${change.clause_title}`;
                return (
                  <Card
                    key={changeKey}
                    className={`overflow-hidden transition-all ${
                      change.is_sneaky_risk
                        ? "border-destructive/50 shadow-sm shadow-destructive/5"
                        : "border-border"
                    }`}
                  >
                    <div className="border-b bg-muted/30 px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{change.clause_title}</span>
                          <Badge
                            variant={
                              change.change_type === "added"
                                ? "default"
                                : change.change_type === "removed"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px] capitalize"
                          >
                            {change.change_type}
                          </Badge>
                          {change.is_sneaky_risk && (
                            <Badge
                              variant="destructive"
                              className="gap-1 text-[10px] font-semibold"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              SNEAKY TRAP
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <CardContent className="space-y-4 p-5">
                      {/* Diff Comparison Blocks */}
                      <div className="grid gap-3 md:grid-cols-2">
                        {change.original_text && (
                          <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 dark:bg-red-950/20">
                            <div className="mb-1 font-semibold text-[11px] text-red-600 uppercase tracking-wide dark:text-red-400">
                              Original Draft (V1)
                            </div>
                            <p className="font-mono text-foreground/80 text-xs leading-relaxed">
                              {change.original_text}
                            </p>
                          </div>
                        )}
                        {change.revised_text && (
                          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
                            <div className="mb-1 font-semibold text-[11px] text-emerald-600 uppercase tracking-wide dark:text-emerald-400">
                              Revised Draft (V2)
                            </div>
                            <p className="font-mono text-foreground/90 text-xs leading-relaxed">
                              {change.revised_text}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Risk Explanation */}
                      {change.risk_explanation && (
                        <div className="rounded-md bg-amber-500/10 p-3 text-amber-900 text-xs dark:text-amber-200">
                          <span className="font-semibold">Trap Analysis: </span>
                          {change.risk_explanation}
                        </div>
                      )}

                      {/* Negotiation Recommendation */}
                      {change.recommendation && (
                        <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 p-3">
                          <div className="space-y-1 text-xs">
                            <span className="font-semibold text-primary">
                              Strategic Counter-Offer:
                            </span>
                            <p className="text-muted-foreground">{change.recommendation}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopy(change.recommendation ?? "", changeKey)}
                            title="Copy counter-offer"
                          >
                            {copiedId === changeKey ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

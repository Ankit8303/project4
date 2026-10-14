import { CitationLink } from "@/components/CitationLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RiskFlag } from "@/lib/schemas";
import { SEVERITY_META } from "@/lib/severity";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookX,
  Check,
  ChevronDown,
  Copy,
  Database,
  Lightbulb,
  Mail,
  Scale,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ClauseCardProps {
  flag: RiskFlag;
}

/** Variants for staggered reveal; consumed by a parent `motion` list. */
export const clauseCardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function humaniseType(value: string): string {
  return value.replace(/_/g, " ");
}

export function ClauseCard({ flag }: ClauseCardProps) {
  const [open, setOpen] = useState(false);
  const [copiedRevision, setCopiedRevision] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const meta = SEVERITY_META[flag.severity_label];

  const handleCopyRevision = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!flag.suggested_revision) return;
    try {
      await navigator.clipboard.writeText(flag.suggested_revision);
      setCopiedRevision(true);
      toast.success("Fair counter-clause copied to clipboard");
      setTimeout(() => setCopiedRevision(false), 2000);
    } catch {
      toast.error("Failed to copy clause");
    }
  };

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!flag.negotiation_email_snippet) return;
    try {
      await navigator.clipboard.writeText(flag.negotiation_email_snippet);
      setCopiedEmail(true);
      toast.success("Negotiation email script copied to clipboard");
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      toast.error("Failed to copy email script");
    }
  };

  return (
    <motion.div variants={clauseCardVariants} className="overflow-hidden rounded-xl border bg-card">
      <div className="flex">
        <div className={cn("w-1.5 shrink-0", meta.bar)} aria-hidden />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex flex-1 items-start gap-3 p-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-transparent", meta.bg, meta.text)}>
                {meta.label} · {flag.severity_score}/5
              </Badge>
              <span className="font-medium text-sm capitalize">
                {humaniseType(flag.clause_type)}
              </span>
              {flag.clause_heading ? (
                <span className="text-muted-foreground text-xs">{flag.clause_heading}</span>
              ) : null}
              {flag.suggested_revision ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-normal"
                >
                  <Sparkles className="h-3 w-3" />
                  Redline Ready
                </Badge>
              ) : null}
              {flag.citations.map((c) => (
                <Badge
                  key={`${c.law_code}:${c.section_number}`}
                  variant="outline"
                  className="gap-1 border-primary/25 bg-primary/10 text-primary dark:text-primary-foreground font-mono text-[11px] font-normal"
                >
                  <Database className="h-3 w-3 text-primary shrink-0" />
                  {c.reference}
                </Badge>
              ))}
              {flag.citations.length === 0 ? (
                <Badge variant="muted" className="gap-1">
                  <BookX className="h-3 w-3" />
                  No citation
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">{flag.clause_excerpt}</p>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t px-4 py-4 pl-5.5">
              {/* Risk explanation */}
              <div>
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                  Why this is risky
                </p>
                <p className="mt-1 text-sm leading-relaxed">{flag.rationale}</p>
              </div>

              {/* Suggested action */}
              {flag.suggested_action ? (
                <div className="flex gap-2 rounded-lg bg-muted/60 p-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-severity-medium" />
                  <p className="text-sm">{flag.suggested_action}</p>
                </div>
              ) : null}

              {/* Redline & Counter-Proposal */}
              {flag.suggested_revision ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                      <Scale className="h-4 w-4" />
                      Fair Counter-Proposal (Redline)
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyRevision}
                      className="h-7 gap-1.5 text-xs border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      {copiedRevision ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Fair Clause
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-red-600 dark:text-red-400 block mb-1">
                        Current Unfair Language:
                      </span>
                      <p className="line-through decoration-red-500/40">{flag.clause_excerpt}</p>
                    </div>

                    <div className="flex justify-center -my-1 text-emerald-600 dark:text-emerald-400">
                      <ArrowRight className="h-3.5 w-3.5 rotate-90" />
                    </div>

                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-foreground">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 block mb-1">
                        Proposed Enforceable Revision:
                      </span>
                      <p className="leading-relaxed font-mono text-[11px] select-all">
                        {flag.suggested_revision}
                      </p>
                    </div>
                  </div>

                  {flag.negotiation_rationale ? (
                    <p className="text-xs text-muted-foreground italic leading-relaxed pt-1 border-t border-emerald-500/20">
                      <span className="font-medium text-foreground not-italic">Strategy: </span>
                      {flag.negotiation_rationale}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Ready-to-Send Negotiation Email */}
              {flag.negotiation_email_snippet ? (
                <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                      <Mail className="h-4 w-4 text-primary" />
                      Ready-to-Send Negotiation Script
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleCopyEmail}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Email Script
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg bg-background/80 p-2.5 text-xs text-foreground leading-relaxed border font-sans select-all">
                    "{flag.negotiation_email_snippet}"
                  </div>
                </div>
              ) : null}

              {/* Statutory backing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Backed by
                  </p>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground/80">
                    <Database className="h-3 w-3 text-primary" />
                    ChromaDB · indian_law
                  </span>
                </div>
                {flag.citations.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {flag.citations.map((citation) => (
                      <CitationLink
                        key={`${citation.law_code}:${citation.section_number}`}
                        citation={citation}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="flex items-start gap-2 text-muted-foreground text-sm">
                    <BookX className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      No citation passed verification for this clause, so this flag rests on the
                      analysis alone. Citations that don't check out against the statute are dropped
                      rather than shown.
                    </span>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

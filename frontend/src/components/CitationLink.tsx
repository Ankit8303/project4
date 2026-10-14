import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Citation } from "@/lib/schemas";
import { Database, ExternalLink, ShieldCheck } from "lucide-react";

interface CitationLinkProps {
  citation: Citation;
}

/** A citation chip that opens a dialog with the full section text and ChromaDB provenance. */
export function CitationLink({ citation }: CitationLinkProps) {
  const isWebGrounded =
    citation.source_url?.includes("google.com") ||
    citation.source_url?.includes("vertexaisearch") ||
    citation.source_url?.includes("indiacode") ||
    citation.source_url?.includes("nic.in") ||
    citation.source_url?.includes("egazette");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground font-medium"
        >
          <Database className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>{citation.reference}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 bg-primary/10 text-primary dark:text-primary-foreground text-xs font-mono"
            >
              <Database className="h-3 w-3 text-primary" />
              ChromaDB · Collection: indian_law
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {citation.law_code}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Section {citation.section_number}
            </Badge>
            {isWebGrounded ? (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
              >
                <ShieldCheck className="h-3 w-3" />
                Live Grounded
              </Badge>
            ) : null}
          </div>
          <DialogTitle className="text-base font-semibold leading-snug">
            {citation.reference}
          </DialogTitle>
          {citation.section_title ? (
            <DialogDescription className="text-sm font-medium text-foreground/80">
              {citation.section_title}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <div className="rounded-xl border bg-muted/40 p-3.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground block mb-1">
              Retrieved Statutory Text:
            </span>
            <p className="max-h-60 overflow-y-auto whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground/90 select-all">
              {citation.snippet}
            </p>
          </div>

          {citation.amendment_note ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
              {citation.amendment_note}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Database className="h-3 w-3 text-primary" />
              Indexed in ChromaDB Vector Repository
            </span>
            {citation.source_url ? (
              <a
                href={citation.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View official legal source
              </a>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

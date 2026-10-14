import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { calculateFairnessScore, downloadTextFile, generateMarkdownReport } from "@/lib/report";
import type { ContractAnalysis } from "@/lib/schemas";
import { Check, Copy, Download, FileCode, FileDown, FileText, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ExportReportModalProps {
  analysis: ContractAnalysis;
}

export function ExportReportModal({ analysis }: ExportReportModalProps) {
  const [copied, setCopied] = useState(false);
  const health = calculateFairnessScore(analysis);

  const handleCopy = async () => {
    try {
      const text = generateMarkdownReport(analysis);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Audit report copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy report");
    }
  };

  const handleDownloadMarkdown = () => {
    const text = generateMarkdownReport(analysis);
    downloadTextFile(`ClauseIQ-Audit-Report-${analysis.contract_id}.md`, text, "text/markdown");
    toast.success("Downloaded Markdown audit report");
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(analysis, null, 2);
    downloadTextFile(`ClauseIQ-Audit-${analysis.contract_id}.json`, json, "application/json");
    toast.success("Downloaded JSON audit data");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <FileDown className="h-4 w-4 text-primary" />
          <span>Export Report</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Export Legal Audit Report
          </DialogTitle>
          <DialogDescription>
            Download or share the comprehensive legal risk assessment and citations.
          </DialogDescription>
        </DialogHeader>

        {/* Quick Summary Pill */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-medium">
              Fairness Score
            </span>
            <span className="text-sm font-bold">
              {health.score}/100 · <span className={health.color}>{health.label}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Flagged Clauses</span>
            <span className="font-medium text-foreground">{analysis.flag_count} clauses</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Statute Backing</span>
            <span className="font-medium text-foreground">{analysis.corpus_version}</span>
          </div>
        </div>

        {/* Export Options */}
        <div className="grid gap-2.5 pt-1">
          <Button
            type="button"
            variant="default"
            onClick={handlePrint}
            className="w-full justify-start gap-2.5 h-11"
          >
            <Printer className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium leading-none">Print or Save as PDF</div>
              <div className="text-[11px] text-primary-foreground/80 font-normal">
                Generates a clean, client-ready printable PDF report
              </div>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadMarkdown}
            className="w-full justify-start gap-2.5 h-11"
          >
            <Download className="h-4 w-4 text-primary" />
            <div className="text-left">
              <div className="font-medium leading-none">Download Word / Markdown (.md)</div>
              <div className="text-[11px] text-muted-foreground font-normal">
                Formatted document compatible with Microsoft Word and Google Docs
              </div>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            className="w-full justify-start gap-2.5 h-11"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="text-left">
              <div className="font-medium leading-none">
                {copied ? "Copied to Clipboard!" : "Copy Full Report Text"}
              </div>
              <div className="text-[11px] text-muted-foreground font-normal">
                Ready to paste into an email or messaging thread
              </div>
            </div>
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleDownloadJson}
            className="w-full justify-start gap-2.5 h-9 text-xs text-muted-foreground"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Download Raw JSON Data</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

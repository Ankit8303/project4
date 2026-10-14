import { AgentTrace } from "@/components/AgentTrace";
import { ClauseCard } from "@/components/ClauseCard";
import { ContractChat } from "@/components/ContractChat";
import { RiskGauge } from "@/components/RiskGauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStreamingAgents } from "@/hooks/useStreamingAgents";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertTriangle, MessageSquareText, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

const listVariants = { visible: { transition: { staggerChildren: 0.06 } } };

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const { request, status, steps, analysis, error, usage, missingInput } = useStreamingAgents(
    id ?? "",
  );
  const [activeTab, setActiveTab] = useState<"flags" | "chat">("flags");

  if (!id || missingInput) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <RiskGauge
              highestSeverity={analysis?.highest_severity}
              flagCount={analysis?.flag_count ?? 0}
            />
            {usage?.cost_usd !== undefined ? (
              <p className="text-muted-foreground text-xs">
                {usage.total_tokens?.toLocaleString()} tokens · ${usage.cost_usd.toFixed(4)}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentTrace steps={steps} />
          </CardContent>
        </Card>
      </aside>

      <section className="space-y-4">
        {/* Navigation Tabs */}
        {analysis && (
          <div className="flex items-center gap-2 border-b pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("flags")}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === "flags"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Flagged Clauses</span>
              <Badge
                variant={activeTab === "flags" ? "secondary" : "outline"}
                className="h-5 px-1.5 text-xs font-semibold"
              >
                {analysis.flag_count}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === "chat"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <MessageSquareText className="h-4 w-4" />
              <span>Chat with Contract</span>
              <Badge
                variant={activeTab === "chat" ? "secondary" : "outline"}
                className="h-5 px-1.5 text-[10px] font-normal gap-1"
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI Q&A
              </Badge>
            </button>
          </div>
        )}

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col items-start gap-3 pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Analysis couldn't complete</span>
              </div>
              <p className="text-muted-foreground text-sm">{error}</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/">Try another contract</Link>
              </Button>
            </CardContent>
          </Card>
        ) : status !== "done" || !analysis ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : activeTab === "chat" ? (
          <ContractChat
            contractText={request?.contract_text ?? ""}
            jurisdiction={request?.jurisdiction}
          />
        ) : analysis.flags.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground text-sm">
              No unfair clauses were flagged in this contract.
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={listVariants}
            className="space-y-3"
          >
            {analysis.flags.map((flag) => (
              <ClauseCard key={flag.clause_id} flag={flag} />
            ))}
          </motion.div>
        )}

        {analysis && activeTab === "flags" ? (
          <p className="text-balance pt-2 text-muted-foreground text-xs">{analysis.disclaimer}</p>
        ) : null}
      </section>
    </div>
  );
}

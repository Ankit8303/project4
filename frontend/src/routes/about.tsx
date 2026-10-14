import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

const MCP_INSTALL_URL = "https://github.com/Pulkitgupta17/ClauseIQ/blob/main/docs/MCP_INSTALL.md";

export default function About() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <header className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">About NyayaShield</h1>
        <p className="text-muted-foreground">
          A multi-agent AI copilot that audits Indian contracts, detects hidden traps, and grounds
          every finding in statutory law.
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed">
        <p>
          A supervisor agent segments contracts into individual clauses, a retriever pulls relevant
          statutory provisions from the Indian Contract Act 1872, Specific Relief Act 1963, and
          Consumer Protection Act 2019 using hybrid retrieval, a risk analyzer scores clauses from
          1–5, and a citation verifier checks every cited section against the statutory corpus to
          eliminate AI hallucinations.
        </p>
        <p>
          NyayaShield also features interactive grounded Q&A ("Chat with Contract"), side-by-side
          contract version diffing to catch stealth modifications by counterparties, and
          comprehensive legal audit report exports.
        </p>
      </section>

      <Card>
        <CardContent className="flex flex-col items-start gap-3 pt-6">
          <h2 className="font-medium">Use it inside Claude Desktop & MCP</h2>
          <p className="text-muted-foreground text-sm">
            Install the MCP server and ask AI assistants to analyse contracts or look up Indian law.
          </p>
          <Button asChild variant="outline" size="sm">
            <a href={MCP_INSTALL_URL} target="_blank" rel="noreferrer">
              MCP install guide
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        NyayaShield is automated decision-support, not legal advice. Amendment history is not
        tracked; verify current law for time-sensitive matters.
      </p>
    </div>
  );
}

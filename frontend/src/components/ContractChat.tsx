import { CitationLink } from "@/components/CitationLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { askContractQuestion } from "@/lib/api";
import type { Citation, Jurisdiction } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Scale,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  excerpts?: string[];
  citations?: Citation[];
  error?: boolean;
}

interface ContractChatProps {
  contractText: string;
  jurisdiction?: Jurisdiction;
}

const SUGGESTED_PROMPTS = [
  "Can the landlord forfeit my entire security deposit?",
  "What is my lock-in period and what are the notice terms?",
  "Is the non-compete clause legally enforceable under Indian law?",
  "Who is responsible for repair, maintenance, and utility bills?",
];

export function ContractChat({ contractText, jurisdiction = "IN-MH" }: ContractChatProps) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll into view when messages or loading changes
  useEffect(() => {
    if (typeof scrollRef.current?.scrollIntoView === "function") {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, loading]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText ?? input).trim();
    if (!q || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg: ChatEntry = { id: userMessageId, role: "user", content: q };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages
        .filter((m) => !m.error)
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await askContractQuestion({
        contract_text: contractText,
        question: q,
        chat_history: history,
        jurisdiction,
      });

      const assistantMsg: ChatEntry = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        excerpts: res.relevant_clause_excerpts,
        citations: res.citations,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to get response";
      const errorEntry: ChatEntry = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Error: ${errMsg}`,
        error: true,
      };
      setMessages((prev) => [...prev, errorEntry]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[650px] rounded-xl border bg-card overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              Chat with Contract
              <Badge variant="outline" className="text-[10px] font-normal gap-1 border-primary/30">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                Grounded Q&A
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Answers are grounded strictly in your contract & Indian statutory law
            </p>
          </div>
        </div>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-1">
              <p className="font-semibold text-base">Ask anything about this contract</p>
              <p className="text-sm text-muted-foreground">
                Get plain-English explanations, see exact quoted clauses, and discover whether a
                term violates Indian law.
              </p>
            </div>

            <div className="w-full max-w-md pt-2 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-left">
                Suggested questions:
              </p>
              <div className="grid gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="text-left text-xs p-2.5 rounded-lg border bg-background hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <Sparkles className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 text-sm",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {msg.role === "assistant" ? (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              ) : null}

              <div
                className={cn(
                  "rounded-2xl px-4 py-3 max-w-[85%] space-y-3",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none ml-auto"
                    : msg.error
                      ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-bl-none"
                      : "bg-muted/50 border rounded-bl-none text-foreground",
                )}
              >
                {msg.error ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{msg.content}</span>
                  </div>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}

                {/* Quoted contract excerpts */}
                {msg.excerpts && msg.excerpts.length > 0 ? (
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      <FileText className="h-3 w-3" />
                      Supporting Contract Excerpts
                    </div>
                    <div className="space-y-1">
                      {msg.excerpts.map((excerpt, idx) => (
                        <div
                          key={`${msg.id}-exc-${idx}`}
                          className="rounded bg-background/80 border p-2 text-xs font-mono text-muted-foreground leading-snug select-all"
                        >
                          "{excerpt}"
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Statutory citations */}
                {msg.citations && msg.citations.length > 0 ? (
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Scale className="h-3 w-3" />
                      Applicable Indian Law
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c) => (
                        <CitationLink key={`${c.law_code}:${c.section_number}`} citation={c} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {msg.role === "user" ? (
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
              ) : null}
            </div>
          ))
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Consulting contract text & Indian statutory law...</span>
          </div>
        ) : null}

        <div ref={scrollRef} />
      </div>

      {/* Input bar */}
      <div className="border-t p-3 bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this contract... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={loading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            className="h-10 px-3.5 gap-1.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>Ask</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

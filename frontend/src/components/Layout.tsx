import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-bold text-xs text-primary-foreground shadow-sm shadow-primary/25">
              <Shield className="h-4 w-4" />
            </span>
            <span className="text-base">
              Nyaya<span className="text-primary font-black">Shield</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/compare">Compare Drafts</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/about">About</Link>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t py-6 text-center text-muted-foreground text-xs">
        NyayaShield · AI-Powered Contract Intelligence for Indian Law · Decision-support, not legal
        advice
      </footer>
    </div>
  );
}

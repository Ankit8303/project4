import { ClauseCard } from "@/components/ClauseCard";
import type { Citation, RiskFlag } from "@/lib/schemas";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

const CITATION: Citation = {
  law_code: "ICA_1872",
  section_number: "74",
  section_title: "Compensation for breach of contract where penalty stipulated for",
  reference: "Section 74, Indian Contract Act, 1872",
  snippet: "When a contract has been broken, if a sum is named in the contract…",
};

function flag(overrides: Partial<RiskFlag> = {}): RiskFlag {
  return {
    clause_id: "contract-1:cl0",
    clause_excerpt: "The entire security deposit shall stand absolutely forfeited.",
    clause_type: "security_deposit",
    severity_score: 5,
    severity_label: "critical",
    rationale: "Forfeiting the whole deposit is a penalty, not a genuine pre-estimate of loss.",
    confidence: 0.98,
    citations: [CITATION],
    ...overrides,
  };
}

describe("ClauseCard", () => {
  it("shows the statute behind a flag the citation verifier backed", async () => {
    render(<ClauseCard flag={flag()} />);

    expect(screen.queryByText("No citation")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button", { name: CITATION.reference })).toBeInTheDocument();
    expect(screen.queryByText(/rests on the analysis alone/)).not.toBeInTheDocument();
  });

  it("says so when no citation survived verification, rather than showing nothing", async () => {
    render(<ClauseCard flag={flag({ citations: [] })} />);

    // Collapsed, the card must not look identical to a flag that a statute backs.
    expect(screen.getByText("No citation")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Backed by")).toBeInTheDocument();
    expect(screen.getByText(/rests on the analysis alone/)).toBeInTheDocument();
  });

  it("renders redline counter-proposal and negotiation script when available", async () => {
    render(
      <ClauseCard
        flag={flag({
          suggested_revision: "Deposit shall only be deducted for actual verified damages.",
          negotiation_rationale: "Aligns with Section 74 penalty restrictions under Indian law.",
          negotiation_email_snippet: "Regarding clause 3, we request updating the deposit terms...",
        })}
      />,
    );

    expect(screen.getByText("Redline Ready")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /The entire security deposit/i }));

    expect(screen.getByText("Fair Counter-Proposal (Redline)")).toBeInTheDocument();
    expect(
      screen.getByText("Deposit shall only be deducted for actual verified damages."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy Fair Clause/i })).toBeInTheDocument();

    expect(screen.getByText("Ready-to-Send Negotiation Script")).toBeInTheDocument();
    expect(
      screen.getByText(/"Regarding clause 3, we request updating the deposit terms..."/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy Email Script/i })).toBeInTheDocument();
  });
});

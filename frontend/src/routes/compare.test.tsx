import * as api from "@/lib/api";
import ComparePage from "@/routes/compare";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

describe("ComparePage", () => {
  it("renders comparison inputs and load sample button", () => {
    render(<ComparePage />);

    expect(screen.getByText("Contract Version Diff & Trap Detector")).toBeInTheDocument();
    expect(screen.getByText("Original Draft (V1)")).toBeInTheDocument();
    expect(screen.getByText("Counterparty Revised Draft (V2)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Load Sample Rental Revision/i }),
    ).toBeInTheDocument();
  });

  it("loads sample text and runs comparison successfully", async () => {
    const compareSpy = vi.spyOn(api, "compareContracts").mockResolvedValueOnce({
      summary: "Revised draft secretly shortens termination notice and adds forfeiture.",
      risk_verdict: "more_risky",
      total_changes: 1,
      sneaky_traps_count: 1,
      changes: [
        {
          change_type: "modified",
          clause_title: "1. TERM AND TERMINATION",
          original_text: "Either party may terminate with 30 days notice.",
          revised_text: "Landlord: 7 days, Tenant: cannot terminate.",
          is_sneaky_risk: true,
          risk_explanation: "One-sided lock in removes tenant flexibility.",
          recommendation: "Demand mutual 30 days termination.",
        },
      ],
    });

    render(<ComparePage />);

    // Click load sample
    const sampleBtn = screen.getByRole("button", { name: /Load Sample Rental Revision/i });
    await userEvent.click(sampleBtn);

    // Click compare button
    const compareBtn = screen.getByRole("button", { name: /Detect Sneaky Changes/i });
    await userEvent.click(compareBtn);

    await waitFor(() => {
      expect(compareSpy).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("HIGH TRAP RISK DETECTED")).toBeInTheDocument();
    expect(screen.getByText("1. TERM AND TERMINATION")).toBeInTheDocument();
    expect(screen.getByText("SNEAKY TRAP")).toBeInTheDocument();
    expect(screen.getByText(/One-sided lock in removes tenant flexibility/)).toBeInTheDocument();
    expect(screen.getByText(/Demand mutual 30 days termination/)).toBeInTheDocument();
  });
});

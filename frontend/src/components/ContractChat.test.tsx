import { ContractChat } from "@/components/ContractChat";
import * as api from "@/lib/api";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const SAMPLE_CONTRACT =
  "Rental Agreement: The deposit of 200,000 shall be fully forfeited on early departure.";

describe("ContractChat", () => {
  it("renders empty state with suggested prompts", () => {
    render(<ContractChat contractText={SAMPLE_CONTRACT} />);

    expect(screen.getByText("Chat with Contract")).toBeInTheDocument();
    expect(screen.getByText("Ask anything about this contract")).toBeInTheDocument();
    expect(
      screen.getByText("Can the landlord forfeit my entire security deposit?"),
    ).toBeInTheDocument();
  });

  it("submits a question and displays the grounded response", async () => {
    const askSpy = vi.spyOn(api, "askContractQuestion").mockResolvedValueOnce({
      answer: "Under Indian law, Section 74 bars penalty forfeitures.",
      relevant_clause_excerpts: [
        "The deposit of 200,000 shall be fully forfeited on early departure.",
      ],
      citations: [
        {
          law_code: "ICA_1872",
          section_number: "74",
          section_title: "Breach of contract",
          reference: "Section 74, Indian Contract Act, 1872",
          snippet: "When a contract has been broken...",
        },
      ],
    });

    render(<ContractChat contractText={SAMPLE_CONTRACT} />);

    const button = screen.getByText("Can the landlord forfeit my entire security deposit?");
    await userEvent.click(button);

    await waitFor(() => {
      expect(askSpy).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText(/Under Indian law, Section 74 bars penalty forfeitures./),
    ).toBeInTheDocument();
    expect(screen.getByText("Supporting Contract Excerpts")).toBeInTheDocument();
    expect(screen.getByText("Applicable Indian Law")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Section 74, Indian Contract Act, 1872" }),
    ).toBeInTheDocument();
  });
});

import { calculateFairnessScore, generateMarkdownReport } from "@/lib/report";
import type { ContractAnalysis } from "@/lib/schemas";
import { describe, expect, it } from "vitest";

const MOCK_ANALYSIS: ContractAnalysis = {
  contract_id: "test-contract-123",
  jurisdiction: "IN-MH",
  flag_count: 2,
  highest_severity: "critical",
  corpus_version: "ICA-1872-v1",
  disclaimer: "Not legal advice.",
  flags: [
    {
      clause_id: "c1",
      clause_heading: "5. Non-Compete",
      clause_excerpt: "Employee shall not work for 2 years.",
      clause_type: "non_compete",
      severity_score: 5,
      severity_label: "critical",
      rationale: "Void under Section 27.",
      confidence: 0.95,
      suggested_revision: "Employee agrees to confidentiality only.",
      negotiation_rationale: "Reasonable for IP protection.",
      negotiation_email_snippet: "Regarding clause 5, we suggest...",
      citations: [
        {
          law_code: "ICA_1872",
          section_number: "27",
          section_title: "Restraint of trade",
          reference: "Section 27, Indian Contract Act, 1872",
          snippet: "Every agreement is void...",
        },
      ],
    },
    {
      clause_id: "c2",
      clause_excerpt: "Tenant pays all repairs.",
      clause_type: "repairs",
      severity_score: 2,
      severity_label: "low",
      rationale: "Minor repair imbalance.",
      confidence: 0.8,
      citations: [],
    },
  ],
};

describe("report generation", () => {
  it("calculates fairness score based on severities", () => {
    const health = calculateFairnessScore(MOCK_ANALYSIS);
    expect(health.score).toBe(71);
    expect(health.label).toBe("Moderate Risk");
  });

  it("generates markdown report with all sections and citations", () => {
    const report = generateMarkdownReport(MOCK_ANALYSIS);
    expect(report).toContain("# LEGAL RISK ASSESSMENT & CLAUSE AUDIT REPORT");
    expect(report).toContain("EXECUTIVE SUMMARY");
    expect(report).toContain("5. Non-Compete");
    expect(report).toContain("Section 27, Indian Contract Act, 1872");
    expect(report).toContain("Proposed Fair Counter-Clause (Redline)");
    expect(report).toContain("Ready-to-Send Negotiation Script");
    expect(report).toContain("LEGAL DISCLAIMER");
  });
});

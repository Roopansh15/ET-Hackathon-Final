import assert from "node:assert/strict";
import test from "node:test";

import { analyzeDocumentPair, extractComplianceLocally } from "../lib/ai-agent.js";

test("extracts a maximum acoustic requirement without an API key", () => {
  const extraction = extractComplianceLocally(
    "Generator sound pressure level shall not exceed 85 dBA at 1 metre.",
    "Submitted sound pressure level is 89 dBA at 1 metre.",
  );

  assert.equal(extraction.operator, "<=");
  assert.equal(extraction.requiredValue, 85);
  assert.equal(extraction.submittedValue, 89);
  assert.equal(extraction.unit, " dBA");
});

test("document-pair agent falls back locally and returns deterministic compliance", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const analysis = await analyzeDocumentPair(
      "Each CRAC unit shall provide at least 150 kW sensible cooling capacity.",
      "The selected CRAC unit provides 142 kW sensible cooling capacity.",
    );

    assert.equal(analysis.agent.aiEnabled, false);
    assert.equal(analysis.result.compliant, false);
    assert.equal(analysis.result.variance, -8);
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  }
});

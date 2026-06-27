import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeScenarios } from "../lib/analyze-project.js";
import { predictPortfolioDelay, predictScenarioDelay } from "../lib/schedule-predictor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "project-data.json")));
const analyses = analyzeScenarios(data);

test("shorter vendor response reduces projected delay", () => {
  const ups = analyses.find((analysis) => analysis.id === "ups-efficiency");
  const fast = predictScenarioDelay(ups, 3);
  const slow = predictScenarioDelay(ups, 7);

  assert.ok(fast.mitigatedDelayDays < slow.mitigatedDelayDays);
  assert.ok(fast.costExposure < slow.costExposure);
});

test("portfolio prediction counts only active critical-path findings", () => {
  const prediction = predictPortfolioDelay(analyses, 7);

  assert.equal(prediction.cumulativeCriticalPathDelayDays, 17);
  assert.equal(prediction.predictions.length, 5);
});

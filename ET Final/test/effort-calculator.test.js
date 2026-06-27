import assert from "node:assert/strict";
import test from "node:test";

import { calculateEffortSavings } from "../lib/effort-calculator.js";

test("calculates a visible manual baseline and automated delta", () => {
  const result = calculateEffortSavings({ pagesIndexed: 412, automatedChecks: 5 });

  assert.equal(result.manualHours, 27.5);
  assert.equal(result.automatedHours, 0.02);
  assert.equal(result.hoursSaved, 27.5);
  assert.match(result.methodology, /412 pages x 4 minutes/);
});

test("rejects negative effort inputs", () => {
  assert.throws(
    () => calculateEffortSavings({ pagesIndexed: -1, automatedChecks: 2 }),
    /cannot be negative/,
  );
});

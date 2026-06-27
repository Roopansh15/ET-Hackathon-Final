import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeScenarios } from "../lib/analyze-project.js";
import { buildCommissioningPlan, updateTestStatus } from "../lib/commissioning.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "project-data.json")));
const standards = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "commissioning-standards.json")));

test("blocks commissioning tests when technical compliance is open", () => {
  const plan = buildCommissioningPlan(standards, analyzeScenarios(projectData));
  const ups = plan.plans.find((item) => item.equipmentType === "UPS");

  assert.equal(ups.readiness, "blocked");
  assert.ok(ups.tests.every((item) => item.status === "blocked"));
  assert.equal(ups.blockedBy[0].id, "UPS-SUB");
});

test("validates commissioning status transitions", () => {
  assert.deepEqual(updateTestStatus({}, "UPS-T01", "passed"), { "UPS-T01": "passed" });
  assert.throws(() => updateTestStatus({}, "UPS-T01", "unknown"), /Unsupported/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeProject } from "../lib/analyze-project.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "project-data.json"), "utf8"),
);

function copySampleData() {
  return {
    ...structuredClone(sampleData.scenarios[0]),
    project: structuredClone(sampleData.project),
  };
}

test("flags a submitted value below a minimum requirement", () => {
  const analysis = analyzeProject(copySampleData());

  assert.equal(analysis.result.compliant, false);
  assert.equal(analysis.result.status, "Does not comply");
  assert.equal(analysis.result.severity, "critical");
  assert.equal(analysis.result.variance, -1.3);
  assert.equal(analysis.result.activeImpact.estimatedDelayDays, 9);
  assert.equal(analysis.result.activeImpact.costExposure, 1800000);
  assert.match(analysis.result.rfi.question, /95\.2%/);
  assert.equal(analysis.result.rfi.evidence.length, 3);
});

test("passes a submitted value above a minimum and removes active exposure", () => {
  const data = copySampleData();
  data.submittal.value = 97.1;
  data.submittal.text = "Double-conversion operating efficiency at 50% load: 97.1%.";

  const analysis = analyzeProject(data);

  assert.equal(analysis.result.compliant, true);
  assert.equal(analysis.result.status, "Complies");
  assert.equal(analysis.result.severity, "closed");
  assert.equal(analysis.result.variance, 0.6);
  assert.equal(analysis.result.activeImpact.estimatedDelayDays, 0);
  assert.equal(analysis.result.activeImpact.costExposure, 0);
  assert.equal(analysis.result.rfi, null);
});

test("passes a submitted value exactly on the requirement boundary", () => {
  const data = copySampleData();
  data.submittal.value = data.requirement.value;

  const analysis = analyzeProject(data);

  assert.equal(analysis.result.compliant, true);
  assert.equal(analysis.result.varianceText, "meets the minimum exactly");
});

test("rejects a comparison between different technical fields", () => {
  const data = copySampleData();
  data.submittal.field = "efficiency_at_100_load";

  assert.throws(
    () => analyzeProject(data),
    /Requirement and submittal fields do not match/,
  );
});

test("rejects an unsupported comparison operator", () => {
  const data = copySampleData();
  data.requirement.operator = "approximately";

  assert.throws(
    () => analyzeProject(data),
    /Unsupported comparison operator/,
  );
});

test("analyses all five equipment scenarios with two passing cases", async () => {
  const { analyzeScenarios } = await import("../lib/analyze-project.js");
  const analyses = analyzeScenarios(sampleData);

  assert.equal(analyses.length, 5);
  assert.equal(analyses.filter((analysis) => analysis.result.compliant).length, 2);
  assert.equal(
    analyses.find((analysis) => analysis.id === "generator-acoustics").result.compliant,
    false,
  );
  assert.equal(
    analyses.find((analysis) => analysis.id === "fire-discharge").result.compliant,
    true,
  );
});

test("rejects a comparison between different units", () => {
  const data = copySampleData();
  data.submittal.unit = " kW";

  assert.throws(() => analyzeProject(data), /units do not match/);
});

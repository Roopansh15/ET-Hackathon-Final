import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeSupplyChain } from "../lib/supply-chain.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "supply-chain.json")));

test("flags delivery later than its required-on-site milestone", () => {
  const analysis = analyzeSupplyChain(data, new Date("2026-06-22T00:00:00Z"));
  const crac = analysis.equipment.find((item) => item.id === "EQ-CRAC-01");

  assert.equal(crac.milestoneVarianceDays, 10);
  assert.equal(crac.severity, "red");
  assert.ok(analysis.alerts.some((alert) => alert.equipmentId === crac.id));
});

test("keeps delivered equipment green when no risk is recorded", () => {
  const analysis = analyzeSupplyChain(data, new Date("2026-06-22T00:00:00Z"));
  const pdu = analysis.equipment.find((item) => item.id === "EQ-PDU-01");

  assert.equal(pdu.severity, "green");
});

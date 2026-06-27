import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  combineHybridScores,
  cosineSimilarity,
  evaluateSearch,
  searchDocuments,
} from "../lib/search-documents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "document-corpus.json"), "utf8"),
);
const evaluationCases = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "evaluation-cases.json"), "utf8"),
);

test("returns a cited UPS efficiency requirement", () => {
  const result = searchDocuments(corpus, "What UPS efficiency is required at 50% load?");

  assert.ok(result.answer.includes("96.5%"));
  assert.equal(result.citations[0].documentId, "DOC-SPEC-ELEC-C");
  assert.equal(result.citations[0].page, 87);
  assert.ok(result.confidence >= 70);
});

test("returns no unsupported answer when evidence does not match", () => {
  const result = searchDocuments(corpus, "Who designed the building facade?");

  assert.equal(result.confidence, 0);
  assert.equal(result.citations.length, 0);
  assert.match(result.answer, /could not find enough cited project evidence/i);
});

test("evaluation cases achieve the target top-citation accuracy", () => {
  const evaluation = evaluateSearch(corpus, evaluationCases);

  assert.equal(evaluation.total, 14);
  assert.ok(
    evaluation.topCitationAccuracy >= 80,
    `Expected at least 80% accuracy, received ${evaluation.topCitationAccuracy}%`,
  );
  assert.equal(evaluation.citationCoverage, 100);
});

test("calculates cosine similarity for embedding vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("hybrid ranking adds semantic similarity without removing lexical evidence", () => {
  const matches = [
    { score: 6, matchedQueryTokens: 2, document: { id: "A" }, chunk: {} },
    { score: 8, matchedQueryTokens: 2, document: { id: "B" }, chunk: {} },
  ];
  const hybrid = combineHybridScores(matches, [1, 0], [[1, 0], [0, 1]]);

  assert.ok(hybrid[0].score > hybrid[1].score);
  assert.equal(hybrid[0].lexicalScore, 6);
  assert.equal(hybrid[0].semanticSimilarity, 1);
});

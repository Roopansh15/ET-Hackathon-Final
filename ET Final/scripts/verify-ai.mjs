import fs from "node:fs";

import { analyzeDocumentPair } from "../lib/ai-agent.js";
import { getAIConfiguration } from "../lib/openai-client.js";
import { searchDocumentsWithAI } from "../lib/search-documents.js";

const configuration = getAIConfiguration();
if (!configuration.enabled) {
  console.error(
    "OPENAI_API_KEY is not configured. Set it, then run npm.cmd run verify:ai.",
  );
  process.exitCode = 2;
} else {
  const corpus = JSON.parse(
    fs.readFileSync(new URL("../data/document-corpus.json", import.meta.url), "utf8"),
  );
  const search = await searchDocumentsWithAI(
    corpus,
    "What sensible cooling capacity did ThermaFlow submit?",
  );
  if (
    search.retrievalMode !== "hybrid-keyword-embeddings" ||
    search.answerMode !== "openai-grounded-synthesis" ||
    search.citations[0]?.documentId !== "DOC-SUB-CRAC-067"
  ) {
    throw new Error("Configured AI search did not return the expected grounded result.");
  }

  const analysis = await analyzeDocumentPair(
    "Generator sound pressure level shall not exceed 85 dBA measured at 1 metre.",
    "The proposed generator sound pressure level at 1 metre is 89 dBA.",
  );
  if (!analysis.agent.aiEnabled || analysis.result.compliant) {
    throw new Error("Configured AI extraction did not return the expected deviation.");
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        generationModel: configuration.model,
        embeddingModel: configuration.embeddingModel,
        retrievalMode: search.retrievalMode,
        answerMode: search.answerMode,
        topCitation: search.citations[0].documentId,
        extractionMode: analysis.agent.mode,
        complianceResult: analysis.result.status,
      },
      null,
      2,
    ),
  );
}

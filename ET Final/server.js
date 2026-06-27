import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeScenarios } from "./lib/analyze-project.js";
import { analyzeDocumentPair } from "./lib/ai-agent.js";
import { buildCommissioningPlan, updateTestStatus } from "./lib/commissioning.js";
import { calculateEffortSavings } from "./lib/effort-calculator.js";
import { getAIConfiguration } from "./lib/openai-client.js";
import { predictPortfolioDelay } from "./lib/schedule-predictor.js";
import { evaluateSearch, searchDocumentsWithAI } from "./lib/search-documents.js";
import { analyzeSupplyChain } from "./lib/supply-chain.js";

const port = Number(globalThis.process?.env?.PORT || 4173);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__dirname, "public");
const dataDirectory = path.join(__dirname, "data");
const dataPaths = {
  project: path.join(dataDirectory, "project-data.json"),
  documents: path.join(dataDirectory, "document-corpus.json"),
  evaluation: path.join(dataDirectory, "evaluation-cases.json"),
  commissioning: path.join(dataDirectory, "commissioning-standards.json"),
  supplyChain: path.join(dataDirectory, "supply-chain.json"),
};

const reviewAudit = [
  {
    id: "AUD-001",
    timestamp: "2026-06-21T09:16:00+05:30",
    actor: "EPC Guardian",
    action: "Portfolio review created",
    detail: "Five equipment scenarios analysed from specification and vendor evidence.",
    type: "system",
  },
];
let commissioningStatuses = {};

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(filePath) {
  return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 250_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must contain valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

async function getProjectPortfolio(responseDays = 7) {
  const projectData = await readJson(dataPaths.project);
  const analyses = analyzeScenarios(projectData);
  const effort = calculateEffortSavings({
    pagesIndexed: projectData.project.pagesIndexed,
    automatedChecks: analyses.length,
  });
  const prediction = predictPortfolioDelay(analyses, responseDays);
  return {
    project: projectData.project,
    analyses,
    summary: {
      total: analyses.length,
      compliant: analyses.filter((item) => item.result.compliant).length,
      nonCompliant: analyses.filter((item) => !item.result.compliant).length,
      critical: analyses.filter(
        (item) => !item.result.compliant && item.scheduleImpact.criticalPath,
      ).length,
    },
    effort,
    prediction,
    ai: {
      enabled: getAIConfiguration().enabled,
      model: getAIConfiguration().enabled ? getAIConfiguration().model : null,
      embeddingModel: getAIConfiguration().enabled
        ? getAIConfiguration().embeddingModel
        : null,
      fallback: "Keyword retrieval and local pattern extraction remain available.",
    },
  };
}

async function handleApi(request, response, pathname, requestUrl) {
  if (pathname === "/api/project-analysis" && request.method === "GET") {
    sendJson(response, 200, await getProjectPortfolio());
    return true;
  }

  if (pathname === "/api/ai-health" && request.method === "GET") {
    const configuration = getAIConfiguration();
    sendJson(response, 200, {
      configured: configuration.enabled,
      generationModel: configuration.enabled ? configuration.model : null,
      embeddingModel: configuration.enabled ? configuration.embeddingModel : null,
      retrievalWhenConfigured: "hybrid keyword and embedding retrieval",
      fallbackWhenUnavailable: "keyword retrieval and local pattern extraction",
    });
    return true;
  }

  if (pathname === "/api/schedule-prediction" && request.method === "GET") {
    const responseDays = Number(requestUrl.searchParams.get("responseDays") || 7);
    const portfolio = await getProjectPortfolio(responseDays);
    sendJson(response, 200, portfolio.prediction);
    return true;
  }

  if (pathname === "/api/documents" && request.method === "GET") {
    const corpus = await readJson(dataPaths.documents);
    const documents = corpus.documents.map(({ chunks, ...document }) => ({
      ...document,
      chunkCount: chunks.length,
    }));
    sendJson(response, 200, { documents });
    return true;
  }

  if (pathname === "/api/search" && request.method === "GET") {
    const query = (requestUrl.searchParams.get("q") || "").trim();
    if (query.length < 3) {
      sendJson(response, 400, { error: "Enter a question containing at least 3 characters." });
      return true;
    }
    const corpus = await readJson(dataPaths.documents);
    sendJson(response, 200, await searchDocumentsWithAI(corpus, query));
    return true;
  }

  if (pathname === "/api/ai-analyze" && request.method === "POST") {
    const payload = await readRequestJson(request);
    sendJson(
      response,
      200,
      await analyzeDocumentPair(payload.specText, payload.submittalText),
    );
    return true;
  }

  if (pathname === "/api/evaluation" && request.method === "GET") {
    const [corpus, evaluationCases] = await Promise.all([
      readJson(dataPaths.documents),
      readJson(dataPaths.evaluation),
    ]);
    sendJson(response, 200, evaluateSearch(corpus, evaluationCases));
    return true;
  }

  if (pathname === "/api/commissioning" && request.method === "GET") {
    const [standards, portfolio] = await Promise.all([
      readJson(dataPaths.commissioning),
      getProjectPortfolio(),
    ]);
    sendJson(
      response,
      200,
      buildCommissioningPlan(standards, portfolio.analyses, commissioningStatuses),
    );
    return true;
  }

  if (pathname === "/api/commissioning/tests" && request.method === "POST") {
    const payload = await readRequestJson(request);
    commissioningStatuses = updateTestStatus(
      commissioningStatuses,
      payload.testId,
      payload.status,
    );
    const [standards, portfolio] = await Promise.all([
      readJson(dataPaths.commissioning),
      getProjectPortfolio(),
    ]);
    sendJson(
      response,
      200,
      buildCommissioningPlan(standards, portfolio.analyses, commissioningStatuses),
    );
    return true;
  }

  if (pathname === "/api/supply-chain" && request.method === "GET") {
    const supplyChain = await readJson(dataPaths.supplyChain);
    sendJson(response, 200, analyzeSupplyChain(supplyChain));
    return true;
  }

  if (pathname === "/api/audit" && request.method === "GET") {
    sendJson(response, 200, { events: reviewAudit });
    return true;
  }

  if (pathname === "/api/reviews" && request.method === "POST") {
    const payload = await readRequestJson(request);
    const allowedDecisions = new Set(["approve-rfi", "dismiss-finding", "request-review"]);
    if (!allowedDecisions.has(payload.decision)) {
      sendJson(response, 400, { error: "Unsupported review decision." });
      return true;
    }

    const labels = {
      "approve-rfi": "RFI approved for issue",
      "dismiss-finding": "Finding dismissed",
      "request-review": "Expert review requested",
    };
    const event = {
      id: `AUD-${String(reviewAudit.length + 1).padStart(3, "0")}`,
      timestamp: new Date().toISOString(),
      actor: payload.actor || "Project QA",
      action: labels[payload.decision],
      detail: payload.note || "Decision recorded through EPC Guardian.",
      type: "human",
    };
    reviewAudit.push(event);
    sendJson(response, 201, { event });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  const requestPath = request.url === "/" ? "/index.html" : request.url;
  const requestUrl = new URL(requestPath, `http://${request.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  try {
    if (await handleApi(request, response, pathname, requestUrl)) {
      return;
    }
  } catch (error) {
    const clientError = /required|unsupported|could not|cannot|invalid/i.test(error.message);
    sendJson(response, clientError ? 400 : 500, {
      error: clientError ? error.message : "The requested service could not complete.",
      detail: error.message,
    });
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API route not found." });
    return;
  }

  const filePath = path.resolve(publicDirectory, `.${pathname}`);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(file);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`EPC Guardian is running at http://localhost:${port}`);
});

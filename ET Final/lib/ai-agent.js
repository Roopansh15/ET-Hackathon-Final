import { analyzeProject } from "./analyze-project.js";
import { createModelResponse, getAIConfiguration } from "./openai-client.js";

const unitPatterns = [
  { pattern: /(-?\d+(?:\.\d+)?)\s*%/i, unit: "%" },
  { pattern: /(-?\d+(?:\.\d+)?)\s*dba\b/i, unit: " dBA" },
  { pattern: /(-?\d+(?:\.\d+)?)\s*kw\b/i, unit: " kW" },
  { pattern: /(-?\d+(?:\.\d+)?)\s*(?:a|amp|amps|amperes?)\b/i, unit: " A" },
  { pattern: /(-?\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b/i, unit: " s" },
  { pattern: /(-?\d+(?:\.\d+)?)\s*(?:min|minutes?)\b/i, unit: " min" },
];

function inferOperator(text) {
  if (/(?:at least|minimum(?: of)?|not less than|>=)/i.test(text)) {
    return ">=";
  }
  if (/(?:not exceed|maximum(?: of)?|within|no more than|<=)/i.test(text)) {
    return "<=";
  }
  if (/(?:shall equal|must equal|exactly|==)/i.test(text)) {
    return "==";
  }
  return null;
}

function inferField(text) {
  const normalised = text.toLowerCase();
  if (normalised.includes("efficiency")) return "efficiency";
  if (normalised.includes("sound") || normalised.includes("acoustic")) return "sound_level";
  if (normalised.includes("sensible") && normalised.includes("capacity")) return "sensible_capacity";
  if (normalised.includes("current")) return "current_rating";
  if (normalised.includes("discharge")) return "discharge_time";
  if (normalised.includes("autonomy")) return "autonomy";
  return "technical_value";
}

function extractValue(text) {
  for (const candidate of unitPatterns) {
    const match = text.match(candidate.pattern);
    if (match) {
      return { value: Number(match[1]), unit: candidate.unit };
    }
  }
  throw new Error("No supported numeric value and unit could be extracted.");
}

export function extractComplianceLocally(specText, submittalText) {
  const required = extractValue(specText);
  const submitted = extractValue(submittalText);
  const operator = inferOperator(specText);
  if (!operator) {
    throw new Error("The requirement operator could not be identified.");
  }

  return {
    field: inferField(specText),
    operator,
    requiredValue: required.value,
    submittedValue: submitted.value,
    unit: required.unit,
    extractionMode: "local-pattern-agent",
    confidence: 78,
  };
}

function toAnalysis(extraction, specText, submittalText) {
  const field = extraction.field.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return analyzeProject({
    id: "ad-hoc-ai-analysis",
    equipmentType: extraction.equipmentType || "Uploaded equipment",
    project: {
      name: "Ad-hoc document review",
      phase: "Technical submittal review",
      completion: 0,
      documentsIndexed: 2,
      pagesIndexed: 2,
      documentsAddedThisWeek: 2,
    },
    finding: {
      id: "AI-NCR-001",
      rfiId: "AI-RFI-001",
      title: extraction.findingTitle || "Submitted technical value does not meet the requirement",
      shortTitle: "AI-extracted compliance deviation",
      confidence: extraction.confidence || 85,
    },
    requirement: {
      id: "UPLOADED-SPEC",
      document: "Uploaded specification text",
      page: 1,
      text: specText,
      field,
      label: extraction.field,
      operator: extraction.operator,
      value: extraction.requiredValue,
      unit: extraction.unit,
    },
    submittal: {
      id: "UPLOADED-SUBMITTAL",
      product: extraction.product || "Proposed equipment",
      document: "Uploaded submittal text",
      page: 1,
      text: submittalText,
      field,
      value: extraction.submittedValue,
      unit: extraction.unit,
    },
    scheduleImpact: {
      task: "Technical approval",
      taskId: "AD-HOC-REVIEW",
      startsInDays: 7,
      estimatedDelayDays: 3,
      affectedTasks: 1,
      criticalPath: false,
      costExposure: 0,
      baseResponseDays: 3,
      delayAssumptions: [{ days: 3, label: "technical clarification" }],
      dependencyPath: [
        { offsetDays: 0, task: "Technical review", note: "Awaiting compliance decision" },
        { offsetDays: 7, task: "Approval gate", note: "Depends on review closure" },
      ],
    },
  });
}

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    equipmentType: { type: "string" },
    product: { type: "string" },
    field: { type: "string" },
    operator: { type: "string", enum: [">=", "<=", "=="] },
    requiredValue: { type: "number" },
    submittedValue: { type: "number" },
    unit: { type: "string" },
    findingTitle: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
  },
  required: [
    "equipmentType",
    "product",
    "field",
    "operator",
    "requiredValue",
    "submittedValue",
    "unit",
    "findingTitle",
    "confidence",
  ],
};

export async function analyzeDocumentPair(specText, submittalText) {
  if (!specText?.trim() || !submittalText?.trim()) {
    throw new Error("Specification text and submittal text are required.");
  }

  if (!getAIConfiguration().enabled) {
    const extraction = extractComplianceLocally(specText, submittalText);
    return {
      ...toAnalysis(extraction, specText, submittalText),
      agent: {
        mode: extraction.extractionMode,
        aiEnabled: false,
        note: "No API key was configured, so transparent local extraction rules were used.",
      },
    };
  }

  try {
    const response = await createModelResponse({
      schema: extractionSchema,
      schemaName: "technical_compliance_extraction",
      instructions:
        "Extract one comparable technical requirement and one submitted value. Use only the supplied text. Preserve the exact unit. Choose >= for minimum requirements, <= for maximum requirements, and == only for exact requirements. Do not decide compliance; deterministic code will do that.",
      input: `SPECIFICATION:\n${specText}\n\nSUBMITTAL:\n${submittalText}`,
    });
    const extraction = JSON.parse(response.text);
    return {
      ...toAnalysis(extraction, specText, submittalText),
      agent: {
        mode: "openai-structured-extraction",
        aiEnabled: true,
        model: response.model,
        responseId: response.responseId,
      },
    };
  } catch (error) {
    const extraction = extractComplianceLocally(specText, submittalText);
    return {
      ...toAnalysis(extraction, specText, submittalText),
      agent: {
        mode: extraction.extractionMode,
        aiEnabled: false,
        note: `AI extraction was unavailable; local fallback used. ${error.message}`,
      },
    };
  }
}

const API_URL = "https://api.openai.com/v1/responses";
const EMBEDDINGS_API_URL = "https://api.openai.com/v1/embeddings";

function extractOutputText(response) {
  if (response.output_text) {
    return response.output_text;
  }

  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

export function getAIConfiguration() {
  const apiKey = globalThis.process?.env?.OPENAI_API_KEY;
  return {
    enabled: Boolean(apiKey),
    apiKey,
    model: globalThis.process?.env?.OPENAI_MODEL || "gpt-5.5",
    embeddingModel:
      globalThis.process?.env?.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  };
}

export async function createEmbeddings(inputs) {
  const configuration = getAIConfiguration();
  if (!configuration.enabled) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error("At least one embedding input is required.");
  }

  const response = await fetch(EMBEDDINGS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: configuration.embeddingModel,
      input: inputs,
      encoding_format: "float",
      dimensions: 512,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Embedding request failed with status ${response.status}.`,
    );
  }

  return {
    vectors: payload.data
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding),
    model: payload.model || configuration.embeddingModel,
    usage: payload.usage || null,
  };
}

export async function createModelResponse({
  instructions,
  input,
  schema,
  schemaName = "response",
}) {
  const configuration = getAIConfiguration();
  if (!configuration.enabled) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const text = schema
    ? {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      }
    : { verbosity: "low" };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: configuration.model,
      instructions,
      input,
      text,
      store: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI request failed with status ${response.status}.`);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("The AI service returned no usable text.");
  }
  return {
    text: outputText,
    model: configuration.model,
    responseId: payload.id,
  };
}

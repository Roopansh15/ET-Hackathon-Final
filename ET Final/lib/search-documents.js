const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "before",
  "did",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "the",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "with"
]);

const aliases = {
  fat: ["factory", "acceptance", "test"],
  submitted: ["submit", "vendor", "submittal"],
  submit: ["submitted", "vendor", "submittal"],
  provide: ["submitted", "vendor", "submittal"],
  requirement: ["required", "specification", "shall"],
  required: ["requirement", "specification", "shall"],
  allowed: ["required", "requirement", "specification", "maximum"],
  maximum: ["required", "requirement", "specification"],
  recorded: ["issued", "log"],
  start: ["starts", "schedule", "activity"],
  costs: ["cost", "exposure", "inr"],
  delay: ["late", "critical", "days"],
  approval: ["approved", "decision"],
  completed: ["completion", "prerequisite", "mandatory"],
  test: ["testing"],
  testing: ["test"],
  generator: ["genset", "powercore"],
  sound: ["acoustic", "dba"],
  cooling: ["crac", "capacity", "sensible"],
  current: ["ampere", "rating", "pdu"],
  fire: ["suppression", "agent", "discharge"],
  time: ["seconds", "duration"],
};

function normaliseToken(token) {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function tokenise(text) {
  return text
    .split(/\s+/u)
    .map(normaliseToken)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function expandTokens(tokens) {
  return [...new Set(tokens.flatMap((token) => [token, ...(aliases[token] || [])]))];
}

function scoreChunk(queryTokens, chunk, document) {
  const titleTokens = tokenise(`${document.name} ${document.type}`);
  const sectionTokens = tokenise(chunk.section);
  const textTokens = tokenise(chunk.text);
  const titleSet = new Set(titleTokens);
  const sectionSet = new Set(sectionTokens);
  const textSet = new Set(textTokens);

  let matchedQueryTokens = 0;
  let score = queryTokens.reduce((total, token) => {
    let matched = false;
    if (titleSet.has(token)) {
      total += 4;
      matched = true;
    }
    if (sectionSet.has(token)) {
      total += 3;
      matched = true;
    }
    if (textSet.has(token)) {
      total += 2;
      matched = true;
    }
    if (matched) {
      matchedQueryTokens += 1;
    }
    return total;
  }, 0);

  if (queryTokens.includes("schedule") && document.type.toLowerCase().includes("schedule")) {
    score += 8;
    matchedQueryTokens += 1;
  }

  const documentType = document.type.toLowerCase();
  const asksForRequirement = queryTokens.some((token) =>
    ["required", "requirement", "specification", "allowed", "maximum", "minimum"].includes(token),
  );
  const asksForSubmission = queryTokens.some((token) =>
    ["submit", "submitted", "submittal", "vendor", "provide"].includes(token),
  );

  if (asksForRequirement && documentType.includes("specification")) {
    score += 12;
  }
  if (asksForSubmission && documentType.includes("vendor submittal")) {
    score += 12;
  }

  return { score, matchedQueryTokens };
}

function buildAnswer(query, matches) {
  if (
    matches.length === 0 ||
    matches[0].score < 4 ||
    matches[0].matchedQueryTokens < 2
  ) {
    return {
      answer: "I could not find enough cited project evidence to answer that question.",
      confidence: 0,
      citations: [],
    };
  }

  const topScore = matches[0].score;
  const citations = matches
    .filter((match) => match.score >= Math.max(4, topScore * 0.7))
    .slice(0, 3)
    .map((match) => ({
      documentId: match.document.id,
      document: match.document.name,
      revision: match.document.revision,
      page: match.chunk.page,
      section: match.chunk.section,
      text: match.chunk.text,
      score: match.score,
    }));

  const confidence = Math.min(98, Math.round(55 + topScore * 4));
  const evidenceSentences = citations.map((citation) => citation.text);

  return {
    answer: evidenceSentences.join(" "),
    confidence,
    citations,
    query,
    answerMode: "keyword-evidence-fallback",
  };
}

function collectMatches(corpus, query) {
  const queryTokens = expandTokens(tokenise(query));
  const matches = [];

  for (const document of corpus.documents) {
    for (const chunk of document.chunks) {
      matches.push({
        document,
        chunk,
        ...scoreChunk(queryTokens, chunk, document),
      });
    }
  }
  return matches;
}

function sortMatches(matches) {
  matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.document.id.localeCompare(right.document.id);
  });
  return matches;
}

export function searchDocuments(corpus, query) {
  return buildAnswer(query, sortMatches(collectMatches(corpus, query)));
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    throw new Error("Embedding vectors must be arrays with equal dimensions.");
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }
  return dotProduct / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function combineHybridScores(matches, queryVector, chunkVectors) {
  if (matches.length !== chunkVectors.length) {
    throw new Error("Every document chunk must have one embedding vector.");
  }

  return matches.map((match, index) => {
    const semanticSimilarity = cosineSimilarity(queryVector, chunkVectors[index]);
    const semanticScore = Math.max(0, semanticSimilarity) * 24;
    return {
      ...match,
      lexicalScore: match.score,
      semanticSimilarity,
      score: match.score + semanticScore,
      matchedQueryTokens:
        match.matchedQueryTokens >= 2 || semanticSimilarity >= 0.62
          ? Math.max(2, match.matchedQueryTokens)
          : match.matchedQueryTokens,
    };
  });
}

async function searchDocumentsHybrid(corpus, query) {
  const matches = collectMatches(corpus, query);
  const texts = matches.map(
    (match) =>
      `${match.document.name}. ${match.document.type}. ${match.chunk.section}. ${match.chunk.text}`,
  );
  const { createEmbeddings } = await import("./openai-client.js");
  const embeddingResult = await createEmbeddings([query, ...texts]);
  const [queryVector, ...chunkVectors] = embeddingResult.vectors;
  const result = buildAnswer(
    query,
    sortMatches(combineHybridScores(matches, queryVector, chunkVectors)),
  );
  return {
    ...result,
    retrievalMode: "hybrid-keyword-embeddings",
    embeddingModel: embeddingResult.model,
  };
}

export async function searchDocumentsWithAI(corpus, query) {
  const { createModelResponse, getAIConfiguration } = await import("./openai-client.js");
  const configuration = getAIConfiguration();
  let result;

  if (configuration.enabled) {
    try {
      result = await searchDocumentsHybrid(corpus, query);
    } catch (error) {
      result = {
        ...searchDocuments(corpus, query),
        retrievalMode: "keyword-fallback",
        embeddingFallbackReason: error.message,
      };
    }
  } else {
    result = {
      ...searchDocuments(corpus, query),
      retrievalMode: "keyword-fallback",
    };
  }

  if (result.citations.length === 0) {
    return result;
  }

  if (!configuration.enabled) {
    return result;
  }

  const evidence = result.citations
    .map(
      (citation, index) =>
        `[${index + 1}] ${citation.document} Rev ${citation.revision}, page ${citation.page}, ${citation.section}\n${citation.text}`,
    )
    .join("\n\n");

  try {
    const response = await createModelResponse({
      instructions:
        "Answer the project question using only the supplied evidence. If the evidence is insufficient, say so. Keep the answer under 120 words. Cite evidence using [1], [2], or [3]. Never invent project facts.",
      input: `QUESTION:\n${query}\n\nEVIDENCE:\n${evidence}`,
    });
    return {
      ...result,
      answer: response.text,
      answerMode: "openai-grounded-synthesis",
      model: response.model,
    };
  } catch (error) {
    return {
      ...result,
      answerMode: "keyword-evidence-fallback",
      aiFallbackReason: error.message,
    };
  }
}

export function evaluateSearch(corpus, evaluationCases) {
  const results = evaluationCases.cases.map((evaluationCase) => {
    const searchResult = searchDocuments(corpus, evaluationCase.query);
    const topCitation = searchResult.citations[0];
    const passed =
      topCitation?.documentId === evaluationCase.expectedDocumentId &&
      topCitation?.page === evaluationCase.expectedPage;

    return {
      ...evaluationCase,
      passed,
      actualDocumentId: topCitation?.documentId || null,
      actualPage: topCitation?.page || null,
      confidence: searchResult.confidence,
    };
  });

  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    topCitationAccuracy: results.length === 0 ? 0 : Math.round((passed / results.length) * 100),
    citationCoverage: results.length === 0
      ? 0
      : Math.round(
          (results.filter((result) => result.actualDocumentId !== null).length / results.length) * 100,
        ),
    results,
  };
}

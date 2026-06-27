const viewTitles = {
  overview: "Project overview",
  assistant: "Ask project",
  compliance: "Compliance review",
  schedule: "Schedule impact",
  commissioning: "Commissioning",
  supply: "Supply chain",
  documents: "Evidence library",
  validation: "Validation",
};

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const pageTitle = document.querySelector("#page-title");
const rfiDialog = document.querySelector("#rfi-dialog");
const toast = document.querySelector("#toast");
const runReviewButton = document.querySelector("#run-review");
const draftButtons = [
  document.querySelector("#draft-rfi"),
  document.querySelector("#draft-rfi-secondary"),
];

let portfolio = null;
let currentAnalysis = null;

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function formatValue(value, unit) {
  return `${value}${unit}`;
}

function formatCurrency(value) {
  return `INR ${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value)}`;
}

function setBadge(element, text, tone) {
  element.textContent = text;
  element.classList.remove("danger", "warning", "success", "neutral");
  element.classList.add(tone);
}

function createBadge(text, tone) {
  const badge = document.createElement("span");
  badge.className = `badge ${tone}`;
  badge.textContent = text;
  return badge;
}

function showView(viewName) {
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}-view`));
  pageTitle.textContent = viewTitles[viewName];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function openEvidence(documentType) {
  showView("compliance");
  window.setTimeout(() => {
    document.querySelector(`#${documentType}-document`).scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 100);
}

function renderTimeline(scheduleImpact, compliant) {
  const timeline = document.querySelector("#schedule-timeline");
  timeline.replaceChildren();
  scheduleImpact.dependencyPath.forEach((step, index) => {
    const item = document.createElement("article");
    item.className = "timeline-item";
    item.classList.toggle("blocked", index === 0 && !compliant);

    const day = document.createElement("span");
    day.textContent = step.offsetDays === 0 ? "Today" : `Day ${step.offsetDays}`;
    const task = document.createElement("strong");
    task.textContent = step.task;
    const note = document.createElement("small");
    note.textContent = compliant
      ? index === 0
        ? "Technical requirement satisfied"
        : "No compliance hold"
      : step.note;
    item.append(day, task, note);
    timeline.append(item);
  });
}

function renderWorkflow(compliant) {
  document.querySelectorAll(".workflow-step").forEach((step, index) => {
    step.classList.remove("complete", "current");
    if (compliant || index < 2) step.classList.add("complete");
    else if (index === 2) step.classList.add("current");
  });
}

function renderScenarioList() {
  const list = document.querySelector("#scenario-list");
  list.replaceChildren();

  portfolio.analyses.forEach((analysis) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-item";
    button.classList.toggle("active", analysis.id === currentAnalysis.id);
    button.addEventListener("click", () => {
      currentAnalysis = analysis;
      renderScenarioList();
      renderAnalysis(analysis);
    });

    const identity = document.createElement("span");
    identity.className = "scenario-identity";
    const type = document.createElement("strong");
    type.textContent = analysis.equipmentType;
    const field = document.createElement("small");
    field.textContent = analysis.requirement.label;
    identity.append(type, field);

    const values = document.createElement("span");
    values.className = "scenario-values";
    values.textContent = `${formatValue(analysis.submittal.value, analysis.submittal.unit)} vs ${analysis.requirement.operator} ${formatValue(analysis.requirement.value, analysis.requirement.unit)}`;
    button.append(identity, values, createBadge(
      analysis.result.compliant ? "Pass" : "Deviation",
      analysis.result.compliant ? "success" : "danger",
    ));
    list.append(button);
  });
}

function renderAnalysis(analysis) {
  const { project, finding, requirement, submittal, scheduleImpact, result } = analysis;
  const compliant = result.compliant;
  const activeImpact = result.activeImpact;

  setText("#project-name", project.name);
  setText("#project-completion", `${project.completion}%`);
  document.querySelector("#project-progress").style.width = `${project.completion}%`;
  setText("#open-deviations", portfolio.summary.nonCompliant);
  setText("#deviation-summary", `${portfolio.summary.critical} critical-path deviations`);
  setText("#documents-indexed", project.documentsIndexed);
  setText("#documents-added", `${project.documentsAddedThisWeek} added this week`);
  setText("#hours-saved", `${portfolio.effort.hoursSaved} h`);
  setText("#effort-methodology", portfolio.effort.methodology);
  setBadge(
    document.querySelector("#portfolio-summary"),
    `${portfolio.summary.compliant} pass / ${portfolio.summary.nonCompliant} review`,
    portfolio.summary.nonCompliant ? "warning" : "success",
  );

  const findingPanel = document.querySelector("#finding-panel");
  findingPanel.classList.toggle("compliant", compliant);
  setText("#finding-label", compliant ? `${analysis.equipmentType} compliance result` : `${analysis.equipmentType} priority finding`);
  setText("#finding-title", result.findingTitle);
  setBadge(
    document.querySelector("#finding-severity"),
    compliant ? "Compliant" : result.severity[0].toUpperCase() + result.severity.slice(1),
    compliant ? "success" : "danger",
  );

  setText("#required-value", formatValue(requirement.value, requirement.unit));
  setText("#submitted-value", formatValue(submittal.value, submittal.unit));
  setText("#variance-text", result.varianceText);
  document.querySelector("#submitted-value").classList.toggle("danger-text", !compliant);
  document.querySelector("#submitted-value").classList.toggle("success-text", compliant);
  setText("#spec-citation", `${requirement.document}, page ${requirement.page}`);
  setText("#submittal-citation", `${submittal.document}, page ${submittal.page}`);

  setText("#next-gate", scheduleImpact.task);
  setText("#starts-in", `${scheduleImpact.startsInDays} days`);
  setText("#potential-delay", `${activeImpact.estimatedDelayDays} days`);
  setText("#affected-tasks", activeImpact.affectedTasks);
  setText("#cost-exposure", formatCurrency(activeImpact.costExposure));
  setBadge(document.querySelector("#impact-status"), compliant ? "Clear" : "Action due", compliant ? "success" : "warning");

  setText("#finding-id", `Finding ${finding.id}`);
  setText("#finding-confidence", `Confidence ${finding.confidence}%`);
  setText("#spec-document-name", requirement.document);
  setText("#spec-page", `Page ${requirement.page}`);
  setText("#requirement-text", requirement.text);
  setText("#requirement-field", requirement.label || requirement.field);
  setText("#requirement-rule", `${requirement.operator} ${formatValue(requirement.value, requirement.unit)}`);
  setText("#submittal-document-name", submittal.document);
  setText("#submittal-page", `Page ${submittal.page}`);
  setText("#submittal-text", submittal.text);
  setText("#submittal-field", requirement.label || submittal.field);
  setText("#observed-value", formatValue(submittal.value, submittal.unit));

  const decisionPanel = document.querySelector("#decision-panel");
  decisionPanel.classList.toggle("compliant", compliant);
  setBadge(document.querySelector("#decision-status"), result.status, compliant ? "success" : "danger");
  setText("#decision-title", result.decisionTitle);
  setText("#decision-explanation", result.explanation);

  setText(
    "#schedule-heading",
    compliant ? `No tasks are blocked by the ${analysis.equipmentType} check` : `${activeImpact.affectedTasks} tasks depend on resolving this ${analysis.equipmentType} finding`,
  );
  setBadge(
    document.querySelector("#schedule-badge"),
    compliant ? "No active exposure" : `${activeImpact.estimatedDelayDays}-day exposure`,
    compliant ? "success" : "warning",
  );
  renderTimeline(scheduleImpact, compliant);
  setText(
    "#schedule-assumption",
    compliant
      ? "This equipment check passes, so it contributes no active delay or cost exposure."
      : `${scheduleImpact.estimatedDelayDays} days = ${scheduleImpact.delayAssumptions.map((item) => `${item.days} days for ${item.label}`).join(" + ")}. The what-if model varies vendor response time while keeping the remaining assumptions visible.`,
  );

  draftButtons.forEach((button, index) => {
    button.disabled = compliant;
    button.textContent = compliant ? "No RFI required" : index === 0 ? "Draft corrective RFI" : "Draft RFI";
  });
  if (result.rfi) {
    setText("#rfi-title", result.rfi.title);
    document.querySelector("#rfi-question").value = result.rfi.question;
    document.querySelector("#rfi-evidence").value = result.rfi.evidence.join("\n");
  }
  renderWorkflow(compliant);
  setBadge(
    document.querySelector("#workflow-status"),
    compliant ? "No action required" : "Human approval required",
    compliant ? "success" : "neutral",
  );
  renderScenarioList();
  loadSchedulePrediction(Number(document.querySelector("#response-days").value));
}

function renderDocuments(documents) {
  const tableBody = document.querySelector("#documents-table-body");
  tableBody.replaceChildren();
  documents.forEach((record) => {
    const row = document.createElement("tr");
    [record.name, record.type, record.revision, formatDate(record.indexedAt)].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const statusCell = document.createElement("td");
    statusCell.append(createBadge(record.status, "success"));
    row.append(statusCell);
    tableBody.append(row);
  });
}

function renderEvaluation(evaluation) {
  setText("#evaluation-accuracy", `${evaluation.topCitationAccuracy}%`);
  setText("#evaluation-coverage", `${evaluation.citationCoverage}%`);
  setText("#evaluation-total", evaluation.total);
  const tableBody = document.querySelector("#evaluation-table-body");
  tableBody.replaceChildren();
  evaluation.results.forEach((result) => {
    const row = document.createElement("tr");
    const values = [
      result.query,
      `${result.expectedDocumentId}, p.${result.expectedPage}`,
      result.actualDocumentId ? `${result.actualDocumentId}, p.${result.actualPage}` : "No citation",
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const resultCell = document.createElement("td");
    resultCell.append(createBadge(result.passed ? "Pass" : "Review", result.passed ? "success" : "warning"));
    row.append(resultCell);
    tableBody.append(row);
  });
}

function renderAudit(events) {
  const list = document.querySelector("#audit-list");
  list.replaceChildren();
  [...events].reverse().forEach((event) => {
    const item = document.createElement("div");
    item.className = "audit-event";
    const marker = document.createElement("span");
    marker.className = `audit-marker ${event.type}`;
    const content = document.createElement("div");
    const heading = document.createElement("div");
    heading.className = "audit-heading";
    const action = document.createElement("strong");
    action.textContent = event.action;
    const time = document.createElement("span");
    time.textContent = formatDate(event.timestamp);
    heading.append(action, time);
    const detail = document.createElement("p");
    detail.textContent = event.detail;
    const actor = document.createElement("small");
    actor.textContent = `Recorded by ${event.actor}`;
    content.append(heading, detail, actor);
    item.append(marker, content);
    list.append(item);
  });
}

function renderSearchResult(result, question) {
  document.querySelector("#answer-empty").hidden = true;
  document.querySelector("#answer-content").hidden = false;
  setText("#answer-question", question);
  setText("#answer-text", result.answer);
  const mode = result.answerMode === "openai-grounded-synthesis" ? "AI grounded" : "Evidence fallback";
  setText("#answer-confidence", `${mode} | Confidence ${result.confidence}%`);

  const citationList = document.querySelector("#citation-list");
  citationList.replaceChildren();
  if (result.citations.length === 0) {
    citationList.append(createBadge("No evidence returned", "warning"));
    return;
  }
  result.citations.forEach((citation, index) => {
    const item = document.createElement("article");
    item.className = "citation-item";
    const number = document.createElement("span");
    number.className = "citation-number";
    number.textContent = index + 1;
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${citation.document} Rev ${citation.revision}, page ${citation.page}`;
    const section = document.createElement("small");
    section.textContent = citation.section;
    const text = document.createElement("p");
    text.textContent = citation.text;
    content.append(title, section, text);
    item.append(number, content);
    citationList.append(item);
  });
}

function renderSchedulePrediction(prediction) {
  const selected = prediction.predictions.find((item) => item.scenarioId === currentAnalysis.id);
  const baseline = portfolio.analyses
    .filter((item) => item.scheduleImpact.criticalPath && !item.result.compliant)
    .reduce((total, item) => total + item.scheduleImpact.estimatedDelayDays, 0);
  setText("#current-delay", `${baseline} days`);
  setText("#mitigated-delay", `${prediction.cumulativeCriticalPathDelayDays} days`);
  setText("#forecast-cost", formatCurrency(prediction.totalCostExposure));

  const list = document.querySelector("#mitigation-list");
  list.replaceChildren();
  (selected?.mitigations || []).forEach((mitigation) => {
    const item = document.createElement("article");
    const title = document.createElement("strong");
    title.textContent = mitigation.title;
    const detail = document.createElement("span");
    detail.textContent = mitigation.impact;
    const impact = createBadge(`Up to ${mitigation.potentialDaysSaved} days`, "success");
    item.append(title, detail, impact);
    list.append(item);
  });
}

function renderCommissioning(data) {
  setBadge(
    document.querySelector("#commissioning-summary"),
    `${data.summary.readyPhases} ready / ${data.summary.blockedPhases} blocked`,
    data.summary.blockedPhases ? "warning" : "success",
  );
  const container = document.querySelector("#commissioning-plans");
  container.replaceChildren();

  data.plans.forEach((plan) => {
    const section = document.createElement("article");
    section.className = "commissioning-plan";
    const header = document.createElement("div");
    header.className = "commissioning-header";
    const identity = document.createElement("div");
    const type = document.createElement("strong");
    type.textContent = plan.equipmentType;
    const phase = document.createElement("span");
    phase.textContent = plan.phase;
    identity.append(type, phase);
    header.append(identity, createBadge(plan.readiness, plan.readiness === "ready" ? "success" : "danger"));

    const prerequisites = document.createElement("div");
    prerequisites.className = "prerequisite-list";
    plan.prerequisites.forEach((prerequisite) => {
      const item = document.createElement("span");
      item.className = prerequisite.met ? "met" : "unmet";
      item.textContent = `${prerequisite.met ? "Ready" : "Blocked"}: ${prerequisite.label}`;
      prerequisites.append(item);
    });

    const tests = document.createElement("div");
    tests.className = "test-list";
    plan.tests.forEach((test) => {
      const row = document.createElement("div");
      row.className = "test-row";
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = test.name;
      const criterion = document.createElement("small");
      criterion.textContent = test.acceptanceCriteria;
      details.append(name, criterion);

      const controls = document.createElement("div");
      controls.className = "test-controls";
      const select = document.createElement("select");
      ["pending", "in-progress", "passed", "failed"].forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = test.status === status;
        select.append(option);
      });
      select.disabled = test.status === "blocked";
      select.title = test.status === "blocked" ? "Complete prerequisites before updating this test." : "Update test status";
      select.addEventListener("change", () => updateCommissioningTest(test.id, select.value));

      const recordButton = document.createElement("button");
      recordButton.type = "button";
      recordButton.className = "secondary-button";
      recordButton.textContent = "Generate record";
      recordButton.addEventListener("click", () => {
        showToast(`${test.recordTemplate.recordId} generated with ${test.recordTemplate.fields.length} controlled fields.`);
      });
      controls.append(select, recordButton);
      row.append(details, controls);
      tests.append(row);
    });
    section.append(header, prerequisites, tests);
    container.append(section);
  });
}

function renderSupplyChain(data) {
  setBadge(
    document.querySelector("#supply-summary"),
    `${data.summary.red} red / ${data.summary.amber} amber / ${data.summary.green} green`,
    data.summary.red ? "danger" : data.summary.amber ? "warning" : "success",
  );
  setText("#alert-count", data.alerts.length);

  const grid = document.querySelector("#equipment-grid");
  grid.replaceChildren();
  data.equipment.forEach((equipment) => {
    const card = document.createElement("article");
    card.className = `equipment-card risk-${equipment.severity}`;
    const header = document.createElement("div");
    header.className = "equipment-header";
    const identity = document.createElement("div");
    const id = document.createElement("span");
    id.textContent = equipment.id;
    const name = document.createElement("strong");
    name.textContent = equipment.description;
    identity.append(id, name);
    header.append(identity, createBadge(equipment.severity.toUpperCase(), equipment.severity === "red" ? "danger" : equipment.severity === "amber" ? "warning" : "success"));
    const facts = document.createElement("dl");
    [
      ["Vendor", equipment.vendor],
      ["Origin", equipment.origin],
      ["Status", equipment.status],
      ["Expected", equipment.expectedDeliveryDate],
      ["Required on site", equipment.requiredOnSiteDate],
    ].forEach(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = value;
      row.append(term, detail);
      facts.append(row);
    });
    card.append(header, facts);
    grid.append(card);
  });

  const alerts = document.querySelector("#alert-list");
  alerts.replaceChildren();
  if (data.alerts.length === 0) {
    alerts.textContent = "No active logistics alerts.";
  }
  data.alerts.forEach((alert) => {
    const item = document.createElement("article");
    const title = document.createElement("strong");
    title.textContent = alert.title;
    const detail = document.createElement("p");
    detail.textContent = alert.detail;
    item.append(createBadge(alert.severity.toUpperCase(), alert.severity === "red" ? "danger" : "warning"), title, detail);
    alerts.append(item);
  });
}

async function requestJson(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}.`);
  return payload;
}

async function loadAnalysis(showCompletionMessage = false) {
  runReviewButton.disabled = true;
  runReviewButton.textContent = "Reviewing...";
  try {
    portfolio = await requestJson("/api/project-analysis");
    currentAnalysis = portfolio.analyses.find((item) => item.id === currentAnalysis?.id) || portfolio.analyses[0];
    renderAnalysis(currentAnalysis);
    setBadge(
      document.querySelector("#ai-status"),
      portfolio.ai.enabled ? `AI: ${portfolio.ai.model}` : "Offline fallback",
      portfolio.ai.enabled ? "success" : "neutral",
    );
    if (showCompletionMessage) {
      showToast(`Portfolio review complete: ${portfolio.summary.nonCompliant} deviations across ${portfolio.summary.total} equipment checks.`);
    }
  } finally {
    runReviewButton.disabled = false;
    runReviewButton.textContent = "Run review";
  }
}

async function loadSchedulePrediction(responseDays) {
  if (!portfolio || !currentAnalysis) return;
  const prediction = await requestJson(`/api/schedule-prediction?responseDays=${responseDays}`);
  renderSchedulePrediction(prediction);
}

async function loadDocuments() {
  renderDocuments((await requestJson("/api/documents")).documents);
}

async function loadEvaluation(showCompletionMessage = false) {
  const button = document.querySelector("#run-evaluation");
  button.disabled = true;
  button.textContent = "Running...";
  try {
    const evaluation = await requestJson("/api/evaluation");
    renderEvaluation(evaluation);
    if (showCompletionMessage) showToast(`Benchmark complete: ${evaluation.passed}/${evaluation.total} top citations correct.`);
  } finally {
    button.disabled = false;
    button.textContent = "Run benchmark";
  }
}

async function loadAudit() {
  renderAudit((await requestJson("/api/audit")).events);
}

async function loadCommissioning() {
  renderCommissioning(await requestJson("/api/commissioning"));
}

async function updateCommissioningTest(testId, status) {
  try {
    const data = await requestJson("/api/commissioning/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, status }),
    });
    renderCommissioning(data);
    showToast(`Commissioning test updated to ${status}.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function loadSupplyChain() {
  renderSupplyChain(await requestJson("/api/supply-chain"));
}

async function searchProject(question) {
  const submitButton = document.querySelector("#ask-submit");
  submitButton.disabled = true;
  submitButton.textContent = "Searching...";
  try {
    renderSearchResult(await requestJson(`/api/search?q=${encodeURIComponent(question)}`), question);
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Search evidence";
  }
}

async function recordDecision(decision, note) {
  const result = await requestJson("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor: "Project QA", decision, note }),
  });
  await loadAudit();
  return result.event;
}

async function runExtractionAgent(specText, submittalText) {
  const button = document.querySelector("#ai-analyze-button");
  button.disabled = true;
  button.textContent = "Analysing...";
  try {
    const analysis = await requestJson("/api/ai-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specText, submittalText }),
    });
    setBadge(
      document.querySelector("#agent-mode"),
      analysis.agent.aiEnabled ? `AI: ${analysis.agent.model}` : "Local fallback",
      analysis.agent.aiEnabled ? "success" : "neutral",
    );
    const result = document.querySelector("#agent-result");
    result.hidden = false;
    result.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = analysis.result.decisionTitle;
    const explanation = document.createElement("p");
    explanation.textContent = `${analysis.result.status}. Extracted ${analysis.requirement.field}: required ${analysis.requirement.operator} ${formatValue(analysis.requirement.value, analysis.requirement.unit)}, submitted ${formatValue(analysis.submittal.value, analysis.submittal.unit)}.`;
    result.append(heading, explanation, createBadge(analysis.result.status, analysis.result.compliant ? "success" : "danger"));
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Run extraction agent";
  }
}

navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.openView)));
document.querySelectorAll("[data-document]").forEach((button) => button.addEventListener("click", () => openEvidence(button.dataset.document)));

draftButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!currentAnalysis?.result.rfi) {
      showToast("No corrective RFI is required for a compliant submission.");
      return;
    }
    rfiDialog.showModal();
  });
});

runReviewButton.addEventListener("click", () => loadAnalysis(true));
document.querySelector("#ask-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const question = document.querySelector("#ask-input").value.trim();
  if (question.length < 3) return showToast("Enter a project question first.");
  searchProject(question);
});
document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question;
    document.querySelector("#ask-input").value = question;
    searchProject(question);
  });
});
document.querySelector("#run-evaluation").addEventListener("click", () => loadEvaluation(true));
document.querySelector("#request-review").addEventListener("click", async () => {
  try {
    await recordDecision("request-review", `Independent review requested for ${currentAnalysis.equipmentType} before contractual action.`);
    showToast("Expert review request recorded.");
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelector("#response-days").addEventListener("input", (event) => {
  setText("#response-days-value", `${event.target.value} days`);
  loadSchedulePrediction(Number(event.target.value)).catch((error) => showToast(error.message));
});
document.querySelector("#ai-analysis-form").addEventListener("submit", (event) => {
  event.preventDefault();
  runExtractionAgent(
    document.querySelector("#ai-spec-text").value,
    document.querySelector("#ai-submittal-text").value,
  );
});
rfiDialog.addEventListener("close", () => {
  if (rfiDialog.returnValue === "confirm") {
    recordDecision(
      "approve-rfi",
      `${currentAnalysis.finding.rfiId} approved with specification, submittal, and schedule evidence attached.`,
    )
      .then(() => showToast("RFI approval recorded and ready for issue."))
      .catch((error) => showToast(error.message));
  }
});

Promise.all([
  loadAnalysis(),
  loadDocuments(),
  loadEvaluation(),
  loadAudit(),
  loadCommissioning(),
  loadSupplyChain(),
]).catch((error) => {
  console.error(error);
  showToast("One or more project services could not be loaded.");
});

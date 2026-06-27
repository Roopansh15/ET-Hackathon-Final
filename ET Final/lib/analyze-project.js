const operatorChecks = {
  ">=": (submitted, required) => submitted >= required,
  "<=": (submitted, required) => submitted <= required,
  "==": (submitted, required) => submitted === required,
};

function round(value, decimalPlaces = 2) {
  const multiplier = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function formatValue(value, unit) {
  return `${value}${unit}`;
}

export function analyzeProject(data) {
  const { finding, requirement, submittal, scheduleImpact } = data;

  if (requirement.field !== submittal.field) {
    throw new Error("Requirement and submittal fields do not match.");
  }

  if (requirement.unit !== submittal.unit) {
    throw new Error("Requirement and submittal units do not match.");
  }

  const check = operatorChecks[requirement.operator];
  if (!check) {
    throw new Error(`Unsupported comparison operator: ${requirement.operator}`);
  }

  const compliant = check(submittal.value, requirement.value);
  const variance = round(submittal.value - requirement.value);
  const severity = compliant
    ? "closed"
    : scheduleImpact.criticalPath
      ? "critical"
      : "major";

  const submittedDisplay = formatValue(submittal.value, submittal.unit);
  const requiredDisplay = formatValue(requirement.value, requirement.unit);
  const differenceDisplay = formatValue(Math.abs(variance), requirement.unit);

  const relationshipText = {
    ">=": {
      pass: variance === 0 ? "meets the minimum exactly" : `${differenceDisplay} above the minimum`,
      fail: `${differenceDisplay} below the minimum`,
      failureTitle: `${submittedDisplay} is lower than the required ${requiredDisplay}`,
    },
    "<=": {
      pass: variance === 0 ? "meets the maximum exactly" : `${differenceDisplay} below the maximum`,
      fail: `${differenceDisplay} above the maximum`,
      failureTitle: `${submittedDisplay} is higher than the allowed ${requiredDisplay}`,
    },
    "==": {
      pass: "matches the required value",
      fail: `${differenceDisplay} away from the required value`,
      failureTitle: `${submittedDisplay} does not equal the required ${requiredDisplay}`,
    },
  }[requirement.operator];

  const decisionTitle = compliant
    ? `${submittedDisplay} meets the required ${requiredDisplay}`
    : relationshipText.failureTitle;

  const result = {
    compliant,
    status: compliant ? "Complies" : "Does not comply",
    severity,
    findingTitle: compliant
      ? `${submittal.product} meets the project requirement`
      : finding.title,
    variance,
    varianceText: compliant ? relationshipText.pass : relationshipText.fail,
    decisionTitle,
    explanation: compliant
      ? "The submitted value meets the project requirement for the same operating condition."
      : "The values refer to the same operating condition. No approved deviation was found in the indexed records.",
    activeImpact: compliant
      ? {
          estimatedDelayDays: 0,
          affectedTasks: 0,
          costExposure: 0,
          criticalPath: false,
        }
      : {
          estimatedDelayDays: scheduleImpact.estimatedDelayDays,
          affectedTasks: scheduleImpact.affectedTasks,
          costExposure: scheduleImpact.costExposure,
          criticalPath: scheduleImpact.criticalPath,
        },
    rfi: compliant
      ? null
      : {
          id: finding.rfiId,
          title: `${finding.rfiId}: ${finding.shortTitle}`,
          question: `Please confirm whether the proposed ${submittal.product} is intended to comply with requirement ${requirement.id}. The submitted value of ${submittedDisplay} does not satisfy the specified rule ${requirement.operator} ${requiredDisplay}. Provide a compliant selection or submit a formal deviation with quantified design, energy, schedule, and commissioning impacts.`,
          evidence: [
            `${requirement.document}, page ${requirement.page}`,
            `${submittal.document}, page ${submittal.page}`,
            `Schedule activity ${scheduleImpact.taskId}, ${scheduleImpact.task}`,
          ],
        },
  };

  return {
    project: data.project,
    id: data.id,
    equipmentType: data.equipmentType,
    finding,
    requirement,
    submittal,
    scheduleImpact,
    result,
  };
}

export function analyzeScenarios(data) {
  if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
    return [analyzeProject(data)];
  }

  return data.scenarios.map((scenario) =>
    analyzeProject({
      ...scenario,
      project: data.project,
    }),
  );
}

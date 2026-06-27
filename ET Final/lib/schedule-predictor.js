function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function predictScenarioDelay(analysis, vendorResponseDays = 7) {
  const responseDays = clamp(Number(vendorResponseDays) || 0, 0, 30);
  const { scheduleImpact, result } = analysis;

  if (result.compliant) {
    return {
      scenarioId: analysis.id,
      equipmentType: analysis.equipmentType,
      responseDays,
      currentDelayDays: 0,
      mitigatedDelayDays: 0,
      costExposure: 0,
      mitigations: [],
    };
  }

  const baselineResponseDays = scheduleImpact.baseResponseDays || 7;
  const fixedDelay = Math.max(0, scheduleImpact.estimatedDelayDays - baselineResponseDays);
  const projectedDelay = fixedDelay + responseDays;
  const accelerationDays = Math.max(0, scheduleImpact.estimatedDelayDays - projectedDelay);
  const dailyExposure = scheduleImpact.costExposure / scheduleImpact.estimatedDelayDays;

  return {
    scenarioId: analysis.id,
    equipmentType: analysis.equipmentType,
    responseDays,
    currentDelayDays: scheduleImpact.estimatedDelayDays,
    mitigatedDelayDays: projectedDelay,
    accelerationDays,
    costExposure: Math.round(projectedDelay * dailyExposure),
    mitigations: [
      {
        title: "Parallel engineering review",
        impact: "Start consultant review while the vendor prepares the revised submission.",
        potentialDaysSaved: Math.min(2, accelerationDays || 2),
      },
      {
        title: "Expedited vendor response",
        impact: "Set a formal response deadline and daily technical clarification call.",
        potentialDaysSaved: Math.min(4, accelerationDays || 4),
      },
      {
        title: "Approved alternative",
        impact: "Evaluate a pre-qualified compliant selection before the current path becomes critical.",
        potentialDaysSaved: Math.min(5, scheduleImpact.estimatedDelayDays),
      },
    ],
  };
}

export function predictPortfolioDelay(analyses, vendorResponseDays = 7) {
  const predictions = analyses.map((analysis) =>
    predictScenarioDelay(analysis, vendorResponseDays),
  );
  const criticalPredictions = predictions.filter((prediction, index) =>
    analyses[index].scheduleImpact.criticalPath && !analyses[index].result.compliant,
  );

  return {
    responseDays: Number(vendorResponseDays),
    cumulativeCriticalPathDelayDays: criticalPredictions.reduce(
      (total, prediction) => total + prediction.mitigatedDelayDays,
      0,
    ),
    totalCostExposure: predictions.reduce(
      (total, prediction) => total + prediction.costExposure,
      0,
    ),
    predictions,
  };
}

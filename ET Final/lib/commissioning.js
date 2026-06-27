function createRecordTemplate(standard, test) {
  return {
    recordId: `TR-${test.id}`,
    equipmentType: standard.equipmentType,
    testName: test.name,
    fields: [
      "Test date",
      "Witnesses",
      "Instruments and calibration dates",
      "Measured results",
      "Acceptance criteria",
      "Pass or fail decision",
      "Comments and corrective actions",
    ],
    acceptanceCriteria: test.acceptanceCriteria,
    requiredAttachments: standard.requiredDocumentation,
  };
}

export function buildCommissioningPlan(standards, analyses, savedStatuses = {}) {
  const complianceByType = new Map(
    analyses.map((analysis) => [
      analysis.equipmentType.toLowerCase(),
      analysis.result.compliant,
    ]),
  );

  const plans = standards.standards.map((standard) => {
    const compliant = complianceByType.get(standard.equipmentType.toLowerCase()) ?? false;
    const prerequisites = standard.prerequisites.map((prerequisite) => ({
      ...prerequisite,
      met: prerequisite.type === "compliance" ? compliant : prerequisite.met,
    }));
    const blockedBy = prerequisites.filter((item) => !item.met);

    const tests = standard.tests.map((test) => {
      const requestedStatus = savedStatuses[test.id] || "pending";
      const status = blockedBy.length > 0 ? "blocked" : requestedStatus;
      return {
        ...test,
        status,
        recordTemplate: createRecordTemplate(standard, test),
      };
    });

    return {
      ...standard,
      readiness: blockedBy.length === 0 ? "ready" : "blocked",
      blockedBy,
      prerequisites,
      tests,
    };
  });

  return {
    summary: {
      totalTests: plans.reduce((total, plan) => total + plan.tests.length, 0),
      readyPhases: plans.filter((plan) => plan.readiness === "ready").length,
      blockedPhases: plans.filter((plan) => plan.readiness === "blocked").length,
    },
    plans,
  };
}

export function updateTestStatus(statuses, testId, status) {
  const allowedStatuses = new Set(["pending", "in-progress", "passed", "failed"]);
  if (!allowedStatuses.has(status)) {
    throw new Error("Unsupported commissioning test status.");
  }
  return { ...statuses, [testId]: status };
}

const DAY_MS = 86_400_000;

function differenceInDays(laterDate, earlierDate) {
  return Math.ceil((new Date(laterDate) - new Date(earlierDate)) / DAY_MS);
}

export function analyzeSupplyChain(data, today = new Date()) {
  const referenceDate = new Date(today);
  referenceDate.setHours(0, 0, 0, 0);

  const equipment = data.equipment.map((item) => {
    const daysUntilDelivery = differenceInDays(item.expectedDeliveryDate, referenceDate);
    const milestoneVarianceDays = differenceInDays(
      item.expectedDeliveryDate,
      item.requiredOnSiteDate,
    );
    const riskReasons = [...(item.riskFlags || [])];

    if (!item.actualDeliveryDate && milestoneVarianceDays > 0) {
      riskReasons.push(`${milestoneVarianceDays} days later than the required-on-site milestone`);
    }
    if (!item.actualDeliveryDate && daysUntilDelivery < 0) {
      riskReasons.push(`${Math.abs(daysUntilDelivery)} days past expected delivery`);
    }

    const severity = riskReasons.some((reason) =>
      /quality|customs|past expected|later than/i.test(reason),
    )
      ? "red"
      : daysUntilDelivery <= 14 && item.status !== "delivered" && item.status !== "installed"
        ? "amber"
        : "green";

    return {
      ...item,
      daysUntilDelivery,
      milestoneVarianceDays,
      severity,
      riskReasons,
    };
  });

  return {
    asOf: referenceDate.toISOString(),
    summary: {
      total: equipment.length,
      red: equipment.filter((item) => item.severity === "red").length,
      amber: equipment.filter((item) => item.severity === "amber").length,
      green: equipment.filter((item) => item.severity === "green").length,
    },
    equipment,
    alerts: equipment
      .filter((item) => item.severity !== "green")
      .map((item) => ({
        equipmentId: item.id,
        severity: item.severity,
        title: `${item.description} requires attention`,
        detail: item.riskReasons[0] || `Delivery is due in ${item.daysUntilDelivery} days.`,
      })),
  };
}

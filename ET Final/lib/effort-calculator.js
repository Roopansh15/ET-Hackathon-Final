const DEFAULT_MINUTES_PER_PAGE = 4;
const DEFAULT_AUTOMATED_SECONDS_PER_CHECK = 12;

function round(value, decimalPlaces = 1) {
  const multiplier = 10 ** decimalPlaces;
  return Math.round(value * multiplier) / multiplier;
}

export function calculateEffortSavings({
  pagesIndexed,
  automatedChecks,
  manualMinutesPerPage = DEFAULT_MINUTES_PER_PAGE,
  automatedSecondsPerCheck = DEFAULT_AUTOMATED_SECONDS_PER_CHECK,
}) {
  if (pagesIndexed < 0 || automatedChecks < 0) {
    throw new Error("Effort inputs cannot be negative.");
  }

  const manualHours = (pagesIndexed * manualMinutesPerPage) / 60;
  const automatedHours = (automatedChecks * automatedSecondsPerCheck) / 3600;
  const hoursSaved = Math.max(0, manualHours - automatedHours);

  return {
    pagesIndexed,
    automatedChecks,
    manualMinutesPerPage,
    automatedSecondsPerCheck,
    manualHours: round(manualHours),
    automatedHours: round(automatedHours, 2),
    hoursSaved: round(hoursSaved),
    methodology: `${pagesIndexed} pages x ${manualMinutesPerPage} minutes/page, minus ${automatedChecks} automated checks x ${automatedSecondsPerCheck} seconds/check.`,
  };
}

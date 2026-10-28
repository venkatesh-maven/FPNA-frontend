// Shared by every dashboard widget that plots a chart.js-style
// {labels, datasets} series (KPI dashboard charts, Financial Overview chart
// cards, etc). Keeping this in one place means all of them stay consistent
// and any future widget — including ones added dynamically via Manage
// Widgets — gets working Ask AI for free, since nothing here is hardcoded
// to a specific widget name.

// Turns {labels, datasets} into a compact text summary so the AI gets the
// actual plotted numbers instead of nothing.
export const buildChartContext = (title, chartData, year) => {
  const labels = Array.isArray(chartData?.labels) ? chartData.labels : [];
  const datasets = Array.isArray(chartData?.datasets) ? chartData.datasets : [];
  if (!labels.length || !datasets.length) {
    return `Chart "${title}"${year ? ` for fiscal year ${year}` : ""} currently has no data.`;
  }
  const series = datasets.map((ds) => {
    const points = labels.map((lbl, i) => `${lbl}=${ds.data?.[i] ?? 0}`).join(", ");
    return `${ds.label || title}: ${points}`;
  });
  return (
    `Chart "${title}"${year ? ` for fiscal year ${year}` : ""}. ` +
    `Use ONLY this as the source of truth:\n${series.join("\n")}`
  );
};

// Generic trend questions that work for any chart title/series.
export const buildChartQuestions = (title) => [
  `Which period had the highest ${title}?`,
  `Which period had the lowest ${title}?`,
  `How did ${title} trend over time?`,
  `What is the overall change in ${title} from the first to the last period?`,
];

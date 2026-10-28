export const AI_HELP_TOOLTIP_ID = "report-ai-help";

/**
 * Attributes that make a button show the shared AI help tooltip
 * (<AIHelpTooltip />). The content travels as data-* attributes so a single
 * tooltip per page can serve every AI button — the report tables have one
 * per value cell.
 *
 *   heading  what the button does            ("Explain with AI")
 *   context  what it applies to              ("Revenue · Jan 2025 · $4.18M")
 *   body     what the user will get
 *   status   optional state line            ("Saved for the current view…")
 */
export const aiHelpTooltipProps = ({ heading, context, body, status }) => ({
  "data-tooltip-id": AI_HELP_TOOLTIP_ID,
  "data-ai-heading": heading,
  "data-ai-context": context,
  "data-ai-body": body,
  "data-ai-status": status,
});

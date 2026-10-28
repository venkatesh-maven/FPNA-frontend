import React from "react";
import { Tooltip } from "react-tooltip";
import { AI_HELP_TOOLTIP_ID } from "./aiHelpTooltipProps";

/** Mount once on a page whose AI buttons use aiHelpTooltipProps. */
export default function AIHelpTooltip() {
  return (
    <Tooltip
      id={AI_HELP_TOOLTIP_ID}
      place="top"
      delayShow={150}
      positionStrategy="fixed"
      opacity={1}
      style={{
        backgroundColor: "#0c4a6e",
        color: "#fff",
        borderRadius: 8,
        padding: "8px 10px",
        maxWidth: 280,
        zIndex: 60,
        textAlign: "left",
        whiteSpace: "normal",
      }}
      render={({ activeAnchor }) => {
        const d = activeAnchor?.dataset;
        if (!d?.aiHeading) return null;
        return (
          <div className="space-y-1">
            <p className="text-xs font-semibold">{d.aiHeading}</p>
            {d.aiContext && <p className="text-[11px] text-sky-200">{d.aiContext}</p>}
            {d.aiBody && <p className="text-xs leading-snug">{d.aiBody}</p>}
            {d.aiStatus && <p className="text-[11px] font-medium text-emerald-300">{d.aiStatus}</p>}
          </div>
        );
      }}
    />
  );
}

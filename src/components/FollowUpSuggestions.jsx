import React from 'react';
import { BsStars } from 'react-icons/bs';

// Renders AI-suggested follow-up questions as clickable chips below an AI
// response. Kept isolated (no input of its own) so a free-text follow-up box
// can be added alongside it later without touching the primary question flow.
const FollowUpSuggestions = ({ suggestions, onSelect, disabled }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-x font-semibold text-sky-700 flex items-center gap-1">
        <BsStars className="text-sky-500" /> Suggested follow-ups
      </p>
      {/* Fixed h-[60px] (~one full pill + half of the next) in both minimized and
          expanded views, so scrolling reveals the rest without growing the panel. */}
      <div className="flex flex-col gap-2 overflow-y-auto pr-1 h-[60px]">
        {suggestions.map((question, idx) => (
          <button
            key={`${idx}-${question}`}
            onClick={() => onSelect(question)}
            disabled={disabled}
            className="w-full text-left px-3 py-1.5 text-s text-sky-800 bg-sky-100 hover:bg-sky-200 rounded-full border border-sky-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FollowUpSuggestions;

import React from "react";

const SIZES = {
  md: { box: "w-8 h-8 text-xs", glyph: "w-5 h-5" },
  lg: { box: "w-12 h-12 text-base", glyph: "w-7 h-7" },
  xl: { box: "w-16 h-16 text-xl", glyph: "w-10 h-10" },
};

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

// Brand logo tile; falls back to a coloured monogram when no logo is available.
const IntegrationLogo = ({ item, size = "md" }) => {
  const { box, glyph } = SIZES[size] || SIZES.md;
  if (item.icon) {
    const Icon = item.icon;
    return (
      <span className={`${box} shrink-0 flex items-center justify-center rounded-lg bg-white border border-gray-100`}>
        <Icon className={glyph} style={{ color: item.color }} />
      </span>
    );
  }
  return (
    <span
      className={`${box} shrink-0 flex items-center justify-center rounded-lg font-semibold text-white`}
      style={{ backgroundColor: item.color }}
    >
      {initials(item.name)}
    </span>
  );
};

export default IntegrationLogo;

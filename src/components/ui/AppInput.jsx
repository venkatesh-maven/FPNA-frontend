import React from "react";

export default function AppInput({ className = "", ...props }) {
  return (
    <input
      className={[
        "w-full rounded-lg border border-sky-200 bg-white px-2 py-1 text-x text-slate-700",
        "outline-none transition-colors duration-200 placeholder:text-slate-400",
        "focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

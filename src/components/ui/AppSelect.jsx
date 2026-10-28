import React from "react";

export default function AppSelect({
  label,
  value,
  onChange,
  options = [],
  className = "",
  selectClassName = "",
  labelClassName = "",
  placeholder,
}) {
  return (
    <div className={className}>
      {label ? (
        <label className={["mb-1 block text-x font-medium text-sky-800", labelClassName].join(" ")}>
          {label}
        </label>
      ) : null}
      <select
        value={value}
        onChange={onChange}
        className={[
          "w-full rounded-lg border border-sky-200 bg-white px-2 py-2 text-x text-slate-700",
          "outline-none transition-colors duration-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
          selectClassName,
        ].join(" ")}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

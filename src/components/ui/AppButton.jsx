import React from "react";

const BUTTON_VARIANTS = {
  primary:
    "bg-sky-900 text-white border border-sky-200 hover:bg-white hover:text-sky-900",
  secondary:
    "bg-white text-sky-900 border border-sky-200 hover:bg-sky-900 hover:text-white",
  outline:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
  icon: "bg-transparent text-slate-700 border border-transparent hover:bg-slate-100",
  skySoft: "bg-sky-100 text-sky-800 border border-sky-200 hover:bg-sky-200",
};

const BUTTON_SIZES = {
  xs: "px-2 py-1 text-x",
  sm: "px-3 py-2 text-x",
  md: "px-4 py-2 text-s",
  icon: "p-1",
  iconSm: "p-1.5",
};

export default function AppButton({
  type = "button",
  children,
  variant = "primary",
  size = "sm",
  className = "",
  ...rest
}) {
  const variantClass = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  const sizeClass = BUTTON_SIZES[size] || BUTTON_SIZES.sm;

  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-1 rounded-lg font-medium transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClass,
        sizeClass,
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

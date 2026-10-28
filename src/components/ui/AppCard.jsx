import React from "react";

const CARD_VARIANTS = {
  default: "bg-white border border-sky-100 shadow-sm",
  subtle: "bg-sky-50 border border-sky-100 shadow-sm",
  glass: "bg-white/10 border border-white/20 shadow-md backdrop-blur",
};

const AppCard = React.forwardRef(function AppCard({
  as: Comp = "div",
  children,
  className = "",
  variant = "default",
  hover = true,
  ...rest
}, ref) {
  const variantClass = CARD_VARIANTS[variant] || CARD_VARIANTS.default;

  return (
    <Comp
      ref={ref}
      {...rest}
      className={[
        "rounded-xl p-4",
        variantClass,
        hover ? "transition-all duration-200 hover:shadow-md" : "",
        className,
      ].join(" ")}
    >
      {children}
    </Comp>
  );
});

export default AppCard;

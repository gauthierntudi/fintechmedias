"use client";

import { BRAND } from "@/lib/brand";
import { useSiteTheme } from "@/components/site/theme-provider";

type BrandLogoProps = {
  onDark?: boolean;
  className?: string;
  height?: number;
};

export function BrandLogo({
  onDark = false,
  className,
  height = 52,
}: BrandLogoProps) {
  const { theme } = useSiteTheme();
  const useWhite = onDark || theme === "dark";
  const classes = ["brand-logo", onDark ? "brand-logo--on-dark" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={useWhite ? BRAND.logoOnDark : BRAND.logo}
      alt={BRAND.name}
      className={classes}
      height={height}
      style={{
        height: `var(--brand-logo-h, ${height}px)`,
        width: "auto",
        display: "block",
      }}
    />
  );
}

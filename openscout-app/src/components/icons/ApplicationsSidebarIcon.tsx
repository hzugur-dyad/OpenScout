import type { SVGProps } from "react";

/** From `notlar/applicaitons-icon.svg` (Streamline); uses `currentColor` for sidebar theming */
export function ApplicationsSidebarIcon({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className={className} {...rest}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
        <path d="M2.25 0.749023h19.5s1.5 0 1.5 1.499997V21.749s0 1.5 -1.5 1.5H2.25s-1.5 0 -1.5 -1.5V2.24902S0.75 0.749023 2.25 0.749023Z" />
        <path d="M12 4.49902 7.5 10.499l-3 -2.99998" />
        <path d="M14.25 8.24902h4.5" />
        <path d="m12 13.499 -4.5 6 -3 -3" />
        <path d="M14.25 17.249h4.5" />
      </g>
    </svg>
  );
}

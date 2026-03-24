"use client";

type OpenScoutLogoMarkProps = {
  className?: string;
  /** Empty when paired with visible "OpenScout" text (decorative). */
  alt?: string;
};

export function OpenScoutLogoMark({
  className = "h-14 w-14",
  alt = "",
}: OpenScoutLogoMarkProps) {
  const gradId = "os-logo-grad-static";
  const maskId = "os-logo-mask-static";

  return (
    <svg
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      width={256}
      height={256}
      className={`block shrink-0 object-contain ${className}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <defs>
        <linearGradient id={gradId} x1="12%" y1="8%" x2="88%" y2="92%">
          <stop offset="0%" stopColor="var(--primary-light)" />
          <stop offset="52%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-dark)" />
        </linearGradient>
        <mask id={maskId}>
          <rect x="-1000" y="-1000" width="3000" height="3000" fill="white" />
          <line
            x1="272.7"
            y1="322.2"
            x2="728.7"
            y2="322.2"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <line
            x1="393.6"
            y1="338.0"
            x2="265.5"
            y2="458.9"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <line
            x1="268.4"
            y1="476.1"
            x2="628.0"
            y2="517.8"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <line
            x1="632.3"
            y1="523.6"
            x2="285.7"
            y2="605.6"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <line
            x1="302.9"
            y1="667.4"
            x2="645.3"
            y2="624.3"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <line
            x1="643.8"
            y1="624.3"
            x2="740.2"
            y2="480.4"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <line
            x1="731.6"
            y1="453.1"
            x2="459.7"
            y2="412.8"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <line
            x1="464.0"
            y1="402.8"
            x2="756.0"
            y2="372.6"
            stroke="black"
            strokeWidth="22"
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <circle
        cx="500"
        cy="500"
        r="252"
        fill={`url(#${gradId})`}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

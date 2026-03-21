type OpenScoutLogoMarkProps = {
  className?: string;
  /** Empty when paired with visible "OpenScout" text (decorative). */
  alt?: string;
};

export function OpenScoutLogoMark({
  className = "h-12 w-12",
  alt = "",
}: OpenScoutLogoMarkProps) {
  return (
    <img
      src="/logo.svg"
      alt={alt}
      className={`shrink-0 object-contain ${className}`}
      width={256}
      height={256}
      decoding="async"
    />
  );
}

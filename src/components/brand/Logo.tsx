/** Two figures leaning together: the "side by side" mark. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className}>
      <circle cx="15" cy="11" r="5.5" className="fill-primary" />
      <path d="M5 35c0-9.5 4.5-15.5 10-15.5S25 25.5 25 35z" className="fill-primary" />
      <circle cx="26" cy="13" r="5" className="fill-secondary" opacity="0.85" />
      <path d="M17 35c0-8.5 4-13.8 9-13.8S35 26.5 35 35z" className="fill-secondary" opacity="0.85" />
    </svg>
  );
}

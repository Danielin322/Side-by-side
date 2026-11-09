/**
 * Placeholder hero illustration: soft line art of a hand holding a phone with a simple form,
 * surrounded by chat bubbles, an envelope and a checklist. Swap for a commissioned piece later.
 * Colors come from theme tokens, so it follows dark mode and high contrast.
 */
export function HeroIllustration({ className = "" }: { className?: string }) {
  const line = "stroke-ink-soft";
  return (
    <svg
      viewBox="0 0 480 440"
      aria-hidden
      className={className}
      fill="none"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Soft background blob */}
      <path
        d="M90 120c40-70 150-95 240-70s130 110 115 190-90 150-190 160S70 360 55 280s-5-90 35-160z"
        className="fill-primary-soft"
      />
      <circle cx="400" cy="345" r="38" className="fill-secondary-soft" />
      <circle cx="78" cy="78" r="22" className="fill-warm-soft" />

      {/* Fingers behind the phone (right edge) */}
      <g className={`fill-warm-soft ${line}`}>
        <rect x="292" y="196" width="46" height="22" rx="11" />
        <rect x="292" y="222" width="50" height="22" rx="11" />
        <rect x="292" y="248" width="46" height="22" rx="11" />
      </g>

      {/* Palm and wrist */}
      <path
        d="M168 440l6-120c2-30 20-46 46-46h70c30 0 50 18 52 50l8 116"
        className={`fill-warm-soft ${line}`}
      />

      {/* Phone */}
      <rect x="172" y="78" width="140" height="256" rx="24" className={`fill-surface ${line}`} />
      <rect x="222" y="92" width="40" height="6" rx="3" className="fill-line" />

      {/* Form on screen */}
      <rect x="192" y="116" width="60" height="8" rx="4" className="fill-ink-soft" opacity="0.5" />
      <g className="stroke-line fill-surface-soft" strokeWidth="2">
        <rect x="192" y="136" width="100" height="26" rx="10" />
        <rect x="192" y="172" width="100" height="26" rx="10" />
        <rect x="192" y="208" width="100" height="26" rx="10" />
      </g>
      <path d="M202 149h40M202 185h55M202 221h32" className="stroke-ink-soft" strokeWidth="2" opacity="0.45" />
      <rect x="192" y="252" width="100" height="30" rx="15" className="fill-primary" />
      <path d="M228 267l8 7 16-14" className="stroke-primary-ink" strokeWidth="3" />

      {/* Thumb over the phone's left edge */}
      <path
        d="M146 330c4-34 22-56 48-64 14-4 24 4 22 16-2 10-12 14-22 20-12 8-18 20-20 34"
        className={`fill-warm-soft ${line}`}
      />

      {/* Chat bubble, start side */}
      <g>
        <path
          d="M52 130h96a20 20 0 0 1 20 20v22a20 20 0 0 1-20 20H86l-18 16v-16H52a20 20 0 0 1-20-20v-22a20 20 0 0 1 20-20z"
          className={`fill-secondary-soft ${line}`}
        />
        <circle cx="72" cy="161" r="4.5" className="fill-secondary" />
        <circle cx="94" cy="161" r="4.5" className="fill-secondary" />
        <circle cx="116" cy="161" r="4.5" className="fill-secondary" />
      </g>

      {/* Chat bubble with heart, end side */}
      <g>
        <path
          d="M336 56h88a18 18 0 0 1 18 18v20a18 18 0 0 1-18 18h-14v14l-16-14h-58a18 18 0 0 1-18-18V74a18 18 0 0 1 18-18z"
          className={`fill-surface ${line}`}
        />
        <path
          d="M380 98c-10-7-17-12-17-19a8 8 0 0 1 17-3 8 8 0 0 1 17 3c0 7-7 12-17 19z"
          className="fill-primary"
        />
      </g>

      {/* Envelope */}
      <g transform="rotate(-8 92 280)">
        <rect x="46" y="250" width="92" height="62" rx="10" className={`fill-surface ${line}`} />
        <path d="M50 256l42 30 42-30" className={line} />
      </g>

      {/* Checklist card */}
      <g transform="rotate(6 392 220)">
        <rect x="352" y="160" width="84" height="110" rx="14" className={`fill-surface ${line}`} />
        <path d="M366 186l6 6 10-11M366 216l6 6 10-11" className="stroke-primary" strokeWidth="3" />
        <rect x="366" y="240" width="16" height="16" rx="4" className="stroke-line" strokeWidth="2.5" />
        <path d="M392 188h30M392 218h30M392 248h22" className="stroke-ink-soft" strokeWidth="2" opacity="0.5" />
      </g>

      {/* Sparkles */}
      <g className="stroke-secondary" strokeWidth="2">
        <path d="M330 140v12M324 146h12" />
        <path d="M150 60v10M145 65h10" />
        <path d="M120 360v10M115 365h10" />
      </g>
    </svg>
  );
}

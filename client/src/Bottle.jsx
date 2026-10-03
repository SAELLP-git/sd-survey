export function Bottle({ ml, visualMl }) {
  const fill = Math.max(0, Math.min(250, visualMl ?? ml)) / 250;
  const bodyTop = 46;
  const bodyHeight = 128;
  const y = bodyTop + bodyHeight * (1 - fill);

  return (
    <svg className="bottle" viewBox="0 0 100 190" aria-hidden="true">
      <rect x="36" y="6" width="28" height="12" rx="3" fill="#1b1228" />
      <path d="M40 18h20l6 24H34z" fill="#1b1228" />
      <rect x="16" y="46" width="68" height="128" rx="22" fill="#fffdfb" stroke="#1b1228" strokeWidth="4" />
      <defs>
        <clipPath id="sip-liquid">
          <rect x="18" y="48" width="64" height="124" rx="20" />
        </clipPath>
        <linearGradient id="sip-saffron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb703" />
          <stop offset="0.55" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#c51622" />
        </linearGradient>
      </defs>
      <g clipPath="url(#sip-liquid)">
        <rect className="liquid" x="18" y={y} width="64" height={bodyHeight} fill="url(#sip-saffron)" />
        <path d={`M18 ${y + 6} C34 ${y - 4}, 52 ${y + 16}, 82 ${y + 4}`} fill="none" stroke="#fff6d0" strokeWidth="3" opacity="0.7" />
      </g>
      <path d="M28 78c8 10 8 22 0 34" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

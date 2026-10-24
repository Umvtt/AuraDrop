// Icons lucide doesn't have, drawn in the same 24px / 2px-stroke style.

const base = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export function TankIcon({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <path d="M3 15.5h18a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5Z" />
      <path d="M5 15.5 6.5 12h11l1.5 3.5" />
      <path d="M8.5 12V9.5h6.5V12" />
      <path d="M15 10.5h7" />
      <circle cx="7" cy="18" r=".6" fill="currentColor" />
      <circle cx="12" cy="18" r=".6" fill="currentColor" />
      <circle cx="17" cy="18" r=".6" fill="currentColor" />
    </svg>
  );
}

export function HangarIcon({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <path d="M2 20V11a10 7 0 0 1 20 0v9" />
      <path d="M6 20v-6h12v6" />
      <path d="M2 20h20" />
      <path d="M9.5 17h5" />
    </svg>
  );
}

export function XrayIcon({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" strokeDasharray="2.5 2.5" />
      <circle cx="9" cy="12" r="2" />
      <path d="M13.5 10h4M13.5 14h3" />
    </svg>
  );
}

export function ArmorIcon({ size = 16 }) {
  return (
    <svg {...base(size)}>
      <path d="M12 2.5 20 6v6c0 5-3.5 8.3-8 9.5C7.5 20.3 4 17 4 12V6Z" />
      <path d="M4.5 10h15M6 15h12" opacity=".6" />
    </svg>
  );
}

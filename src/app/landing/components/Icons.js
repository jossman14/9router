// One icon family for the whole landing: 24×24, 1.75 stroke, round caps.
// Hand-inlined rather than pulled from a package — a landing page should not
// ship an icon library for fifteen glyphs.
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

export const IconRoute = (p) => (
  <svg {...base} {...p}><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h5a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5" /></svg>
);
export const IconLayers = (p) => (
  <svg {...base} {...p}><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 17.5 9 5 9-5" /></svg>
);
export const IconShield = (p) => (
  <svg {...base} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconGauge = (p) => (
  <svg {...base} {...p}><path d="M12 15V9" /><path d="M3.5 18a9 9 0 1 1 17 0" /><circle cx="12" cy="18" r="1.5" /></svg>
);
export const IconKey = (p) => (
  <svg {...base} {...p}><circle cx="7.5" cy="15.5" r="4" /><path d="m10.5 12.5 8-8" /><path d="m17 6 2.5 2.5" /><path d="m14.5 8.5 2.5 2.5" /></svg>
);
export const IconSwap = (p) => (
  <svg {...base} {...p}><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></svg>
);
export const IconBolt = (p) => (
  <svg {...base} {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
);
export const IconChart = (p) => (
  <svg {...base} {...p}><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 15 3.5-4 3 2.5L18 8" /></svg>
);
export const IconTerminal = (p) => (
  <svg {...base} {...p}><rect x="2.5" y="4" width="19" height="16" rx="2.5" /><path d="m7 10 2.5 2L7 14" /><path d="M12.5 14.5h4.5" /></svg>
);
export const IconGlobe = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="m4.5 12.5 4.5 4.5L19.5 6.5" /></svg>
);
export const IconCheckCircle = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></svg>
);
export const IconArrowRight = (p) => (
  <svg {...base} {...p}><path d="M4.5 12h14" /><path d="m13 6.5 5.5 5.5-5.5 5.5" /></svg>
);
export const IconMenu = (p) => (
  <svg {...base} {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
);
export const IconClose = (p) => (
  <svg {...base} {...p}><path d="m6 6 12 12" /><path d="m18 6-12 12" /></svg>
);
export const IconWarning = (p) => (
  <svg {...base} {...p}><path d="M12 4 2.8 20h18.4L12 4Z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></svg>
);
export const IconClock = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></svg>
);
export const IconCode = (p) => (
  <svg {...base} {...p}><path d="m8.5 8-4.5 4 4.5 4" /><path d="m15.5 8 4.5 4-4.5 4" /></svg>
);
export const IconUsers = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.25" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3.25 3.25 0 0 1 0 6.4" /><path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" /></svg>
);
export const IconPlug = (p) => (
  <svg {...base} {...p}><path d="M9 3v5" /><path d="M15 3v5" /><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8Z" /><path d="M12 16.5V21" /></svg>
);

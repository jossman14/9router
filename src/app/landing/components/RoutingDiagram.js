// Product visual: the real request path through 9Router — client format in,
// one endpoint, translated out to whichever provider is healthy. Nothing here
// claims a metric; it is a structural diagram of what the gateway does.
const CLIENTS = [
  { y: 44, label: "OpenAI SDK" },
  { y: 104, label: "Claude Code" },
  { y: 164, label: "Gemini CLI" },
  { y: 224, label: "Cursor / IDE" },
];

const PROVIDERS = [
  { y: 34, label: "OpenAI", note: "Akun 1" },
  { y: 94, label: "Anthropic", note: "Akun 1–3" },
  { y: 154, label: "Google Gemini", note: "Akun 1–2" },
  { y: 214, label: "40+ provider lain", note: "OAuth / API key" },
];

function Node({ x, y, w, label, note, tone = "plain" }) {
  const h = note ? 44 : 34;
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx="9"
        fill="#fff"
        stroke={tone === "accent" ? "var(--lp-blue-200)" : "var(--lp-border-2)"}
      />
      <text x={x + 14} y={y + (note ? 19 : 21)} fontSize="12.5" fontWeight="600" fill="var(--lp-ink)">
        {label}
      </text>
      {note && (
        <text x={x + 14} y={y + 34} fontSize="10.5" fill="var(--lp-subtle)">{note}</text>
      )}
    </g>
  );
}

export default function RoutingDiagram() {
  return (
    <div className="lp-diagram">
      <svg
        className="lp-diagram__svg"
        viewBox="0 0 900 290"
        role="img"
        aria-label="Diagram alur: berbagai klien AI mengirim permintaan ke satu endpoint 9Router, yang menerjemahkan format dan meneruskannya ke provider yang sehat dengan fallback antar akun."
      >
        {/* client → router: each client funnels into the single endpoint */}
        <path d="M 186 61 H 258 Q 272 61 272 75 V 131 Q 272 145 286 145 H 330" fill="none" stroke="var(--lp-blue-200)" strokeWidth="1.5" />
        <path d="M 186 121 H 272 Q 286 121 286 135 V 145 H 330" fill="none" stroke="var(--lp-blue-200)" strokeWidth="1.5" />
        <path d="M 186 181 H 272 Q 286 181 286 167 V 155 H 330" fill="none" stroke="var(--lp-blue-200)" strokeWidth="1.5" />
        <path d="M 186 241 H 258 Q 272 241 272 227 V 169 Q 272 155 286 155 H 330" fill="none" stroke="var(--lp-blue-200)" strokeWidth="1.5" />

        {/* router → providers */}
        <path d="M 570 150 H 610 Q 624 150 624 136 V 65 Q 624 51 638 51" fill="none" stroke="var(--lp-blue-300)" strokeWidth="1.5" />
        <path d="M 570 150 H 610 Q 624 150 624 136 V 125 Q 624 111 638 111" fill="none" stroke="var(--lp-blue-500)" strokeWidth="2" className="lp-flow-dash" />
        <path d="M 570 150 H 610 Q 624 150 624 164 V 171 Q 624 185 638 185" fill="none" stroke="var(--lp-blue-300)" strokeWidth="1.5" />
        <path d="M 570 150 H 610 Q 624 150 624 164 V 231 Q 624 245 638 245" fill="none" stroke="var(--lp-blue-300)" strokeWidth="1.5" />

        {/* clients */}
        {CLIENTS.map((c) => <Node key={c.label} x={26} y={c.y} w={160} label={c.label} />)}
        <text x={26} y={22} fontSize="10.5" fontWeight="700" letterSpacing="1.2" fill="var(--lp-subtle)">KLIEN ANDA</text>

        {/* router core */}
        <rect x="330" y="76" width="240" height="148" rx="16" fill="var(--lp-blue-600)" />
        <rect x="330" y="76" width="240" height="148" rx="16" fill="url(#lpCore)" />
        <text x="450" y="112" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="1.4" fill="rgba(255,255,255,.72)">9ROUTER</text>
        <text x="450" y="140" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">Satu Endpoint</text>
        <text x="450" y="163" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,.82)">/v1/chat/completions</text>
        <g>
          <rect x="356" y="180" width="86" height="26" rx="13" fill="rgba(255,255,255,.16)" />
          <text x="399" y="197" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff">Translate</text>
          <rect x="452" y="180" width="92" height="26" rx="13" fill="rgba(255,255,255,.16)" />
          <text x="498" y="197" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff">Kuota + Log</text>
        </g>

        {/* providers */}
        {PROVIDERS.map((p) => (
          <Node key={p.label} x={638} y={p.y} w={236} label={p.label} note={p.note} tone="accent" />
        ))}
        <text x="638" y="22" fontSize="10.5" fontWeight="700" letterSpacing="1.2" fill="var(--lp-subtle)">PROVIDER UPSTREAM</text>

        <defs>
          <linearGradient id="lpCore" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity=".18" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <p className="lp-diagram__caption">
        Ilustrasi alur permintaan. Garis biru menandai rute aktif yang dipilih 9Router.
      </p>
    </div>
  );
}

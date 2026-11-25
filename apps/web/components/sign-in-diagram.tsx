// what the app does, drawn as a blueprint: a resume and a job post feed the scanner, and lanes run out to every feature
// yellow pulses run along the lines on a loop, and each lane ends in a clay bubble naming the feature

// the feature at the end of each lane, its clay color and how far down the drawing it sits
const FEATURES = [
  { label: "Rewrite suggestions", color: "var(--clay-mint)", y: 70 },
  { label: "Cover letters", color: "var(--clay-butter)", y: 150 },
  { label: "Application tracker", color: "var(--clay-cloud)", y: 230 },
  { label: "Find Jobs", color: "var(--clay-peach)", y: 310 },
  { label: "Interview practice", color: "var(--clay-mint)", y: 390 },
];

// the size of the drawing, the bubbles are placed as fractions of it
const W = 560;
const H = 460;

// where the scanner sits and where the lanes end
const CORE = { x: 250, y: 230 };
const LANE_END = 380;

// a lane from the scanner out to a feature, a soft curve that leaves flat and arrives flat
function lane(y: number) {
  return `M${CORE.x + 50} ${CORE.y} C ${CORE.x + 100} ${CORE.y}, ${LANE_END - 60} ${y}, ${LANE_END} ${y}`;
}

// the two inputs: a curve from each sheet into the scanner
const INPUTS = [
  { label: "resume", y: 130, path: `M110 130 C 160 130, 170 ${CORE.y}, ${CORE.x - 50} ${CORE.y}` },
  { label: "job post", y: 330, path: `M110 330 C 160 330, 170 ${CORE.y}, ${CORE.x - 50} ${CORE.y}` },
];

// a line drawn in the blueprint white, with a yellow pulse riding along it on its own beat
function Wire({ d, delay }: { d: string; delay: number }) {
  return (
    <g>
      <path d={d} pathLength={1000} className="trace" stroke="var(--bp-line)" strokeWidth="1.5" fill="none" />
      <path d={d} pathLength={1000} className="pulse" stroke="var(--bp-hot)" strokeWidth="3" strokeLinecap="round" fill="none" style={{ animationDelay: `${delay}s` }} />
    </g>
  );
}

// a little sheet of paper with lines on it, the resume and the job post
function Sheet({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <path d={`M30 ${y - 45}h62l18 18v72H30z`} pathLength={1000} className="trace" stroke="var(--bp-line)" strokeWidth="1.5" fill="var(--bp-deep)" />
      <path d={`M92 ${y - 45}v18h18`} stroke="var(--bp-line)" strokeWidth="1.5" fill="none" />
      <path d={`M42 ${y - 12}h48M42 ${y}h56M42 ${y + 12}h40M42 ${y + 24}h50`} stroke="var(--bp-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <text x="70" y={y + 66} textAnchor="middle" fontSize="11" fill="var(--bp-muted)" fontFamily="var(--font-drawing)" letterSpacing="1.5">
        {label.toUpperCase()}
      </text>
    </g>
  );
}

export function SignInDiagram() {
  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" fill="none">
        {/* the two inputs and the lines into the scanner */}
        {INPUTS.map((input, i) => (
          <g key={input.label}>
            <Sheet y={input.y} label={input.label} />
            <Wire d={input.path} delay={i * 0.24} />
          </g>
        ))}

        {/* the lanes out to each feature, each pulse a beat after the one before */}
        {FEATURES.map((feature, i) => (
          <Wire key={feature.label} d={lane(feature.y)} delay={0.9 + i * 0.3} />
        ))}

        {/* the scanner: a ring that glows as the pulses arrive, the score inside, a dimension line under it */}
        <circle cx={CORE.x} cy={CORE.y} r="50" fill="var(--bp-deep)" stroke="var(--bp-line)" strokeWidth="1.5" />
        <circle cx={CORE.x} cy={CORE.y} r="58" className="core-glow" stroke="var(--bp-hot)" strokeWidth="2" />
        <text x={CORE.x} y={CORE.y + 8} textAnchor="middle" fontSize="34" fontWeight="800" fill="var(--bp-text)" fontFamily="var(--font-display)">
          62
        </text>
        <text x={CORE.x} y={CORE.y + 28} textAnchor="middle" fontSize="9" fill="var(--bp-hot)" fontFamily="var(--font-drawing)" letterSpacing="1.5">
          MATCH
        </text>
        <g stroke="var(--bp-muted)" strokeWidth="1" opacity="0.8">
          <line x1={CORE.x - 50} y1={CORE.y + 80} x2={CORE.x + 50} y2={CORE.y + 80} />
          <line x1={CORE.x - 50} y1={CORE.y + 75} x2={CORE.x - 50} y2={CORE.y + 85} />
          <line x1={CORE.x + 50} y1={CORE.y + 75} x2={CORE.x + 50} y2={CORE.y + 85} />
        </g>
        <text x={CORE.x} y={CORE.y + 98} textAnchor="middle" fontSize="9" fill="var(--bp-muted)" fontFamily="var(--font-drawing)" letterSpacing="1.5">
          SCAN / 0-100
        </text>
      </svg>

      {/* the clay bubbles at the end of each lane, placed over the drawing */}
      {FEATURES.map((feature) => (
        <span
          key={feature.label}
          style={{ background: feature.color, left: `${(LANE_END / W) * 100}%`, top: `${(feature.y / H) * 100}%` }}
          className="clay float absolute -translate-y-1/2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold"
        >
          {feature.label}
        </span>
      ))}
    </div>
  );
}

import { scoreBand } from "@resumefit/scoring";

// ring sizes in pixels
const SIZES = { sm: 40, md: 72, lg: 144 } as const;

// ring color for each score band
const COLORS = { good: "var(--success)", okay: "var(--warning)", low: "var(--danger)" } as const;

type ScoreRingProps = {
  score: number;
  size?: keyof typeof SIZES;
  label?: string;
};

// the circular match rate gauge
export function ScoreRing({ score, size = "md", label = "Match rate" }: ScoreRingProps) {
  const value = Math.min(100, Math.max(0, Math.round(score)));
  const pixels = SIZES[size];
  const stroke = size === "lg" ? 12 : size === "md" ? 7 : 5;
  const radius = (pixels - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // how much of the ring to fill in
  const filled = (value / 100) * circumference;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="relative inline-flex items-center justify-center"
      style={{ width: pixels, height: pixels }}
    >
      <svg width={pixels} height={pixels} className="-rotate-90" aria-hidden>
        {/* grey track */}
        <circle cx={pixels / 2} cy={pixels / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        {/* colored fill */}
        <circle
          cx={pixels / 2}
          cy={pixels / 2}
          r={radius}
          fill="none"
          stroke={COLORS[scoreBand(value)]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      {/* number in the middle */}
      <span className={`absolute font-semibold tabular-nums ${size === "lg" ? "text-3xl" : size === "md" ? "text-base" : "text-xs"}`}>
        {value}
        {size !== "sm" && "%"}
      </span>
    </div>
  );
}

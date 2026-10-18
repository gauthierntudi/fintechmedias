import "./view-progress.css";

const RADIUS = 16;

/** Une couleur par tranche de 5 % : rouge en bas, vert en haut. */
function progressColor(percent: number) {
  const band = Math.min(19, Math.max(0, Math.ceil(percent / 5) - 1));
  const hue = Math.round(6 + (band / 19) * 106);
  return `hsl(${hue} 88% 52%)`;
}

export function ViewProgress({
  percent,
  className = "",
}: {
  percent: number;
  className?: string;
}) {
  if (percent <= 0) return null;

  const length = 2 * Math.PI * RADIUS;
  const offset = length * (1 - percent / 100);

  return (
    <span
      className={`opt-progress ${className}`.trim()}
      aria-label={`${percent} % des vues`}
    >
      <svg className="opt-progress__ring" viewBox="0 0 46 46" aria-hidden>
        <circle cx="23" cy="23" r={RADIUS} />
        <circle
          cx="23"
          cy="23"
          r={RADIUS}
          stroke={progressColor(percent)}
          strokeDasharray={length}
          strokeDashoffset={offset}
        />
      </svg>
      <span>
        {percent}
        <small>%</small>
      </span>
    </span>
  );
}

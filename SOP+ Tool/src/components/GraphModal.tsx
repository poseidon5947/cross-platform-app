import { useEffect, useRef, useState } from "react";
import type { SopState } from "../types";

export type GraphType = "completion_trend" | "category_breakdown";

interface GraphModalProps {
  type: GraphType;
  state: SopState;
  onClose: () => void;
}

function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function Sparkline({ points, color, width = 320, height = 90 }: { points: number[]; color: string; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const pad = 4;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (width - pad * 2));
  const ys = points.map((v) => pad + (1 - (v - min) / range) * (height - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${height} L${xs[0].toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 4 : 0} fill={color} />)}
    </svg>
  );
}

function DonutChart({ slices, size = 110 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const cx = size / 2, cy = size / 2, r = size * 0.38, inner = size * 0.24;
  let angle = -Math.PI / 2;
  const paths = slices.map((sl) => {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const ix1 = cx + inner * Math.cos(angle - sweep), iy1 = cy + inner * Math.sin(angle - sweep);
    const ix2 = cx + inner * Math.cos(angle), iy2 = cy + inner * Math.sin(angle);
    return { d: `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${inner},${inner} 0 ${large} 0 ${ix1.toFixed(2)},${iy1.toFixed(2)} Z`, color: sl.color };
  });
  return (
    <div className="gm-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth={1.5} />)}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="#132135">{total}</text>
      </svg>
      <div className="gm-legend">
        {slices.map((sl, i) => (
          <div key={i} className="gm-legend-row">
            <span className="gm-legend-dot" style={{ background: sl.color }} />
            <span className="gm-legend-lbl">{sl.label}</span>
            <span className="gm-legend-val">{sl.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletionTrendGraph({ state }: { state: SopState }) {
  const days = last30Days();
  const publishedByDay = days.map((d) => state.sops.filter((sop) => sop.updatedAt?.slice(0, 10) === d && sop.status === "published").length);
  const total30 = publishedByDay.reduce((s, v) => s + v, 0);
  const inReview = state.sops.filter((sop) => sop.status === "in_review").length;
  const published = state.sops.filter((sop) => sop.status === "published").length;
  const labels = [days[0], days[14], days[29]].map(dateLabel);
  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val">{total30}</div><div className="gm-stat-lbl">Published (30d)</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{inReview}</div><div className="gm-stat-lbl">In review</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{published}</div><div className="gm-stat-lbl">Total published</div></div>
      </div>
      <div className="gm-chart-label">SOPs Published — Last 30 Days</div>
      <div className="gm-sparkwrap">
        <Sparkline points={publishedByDay} color="#14a2a4" />
        <div className="gm-x-labels">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  published: "#1a9d5e",
  in_review: "#b87200",
  in_progress: "#0b6ea8",
  assigned: "#8a99ad",
  archived: "#1c1e20",
};

const STATUS_LABELS: Record<string, string> = {
  published: "Published",
  in_review: "In review",
  in_progress: "In progress",
  assigned: "Assigned",
  archived: "Archived",
};

function CategoryBreakdownGraph({ state }: { state: SopState }) {
  const byStatus = Object.keys(STATUS_LABELS).map((status) => ({
    label: STATUS_LABELS[status],
    value: state.sops.filter((sop) => sop.status === status).length,
    color: STATUS_COLORS[status],
  })).filter((s) => s.value > 0);
  const byCategory = state.categories.map((category) => ({
    label: category.name,
    sops: state.sops.filter((sop) => sop.categoryId === category.id && sop.status !== "archived").length,
    published: state.sops.filter((sop) => sop.categoryId === category.id && sop.status === "published").length,
  })).filter((c) => c.sops > 0);
  return (
    <div className="gm-content">
      <div className="gm-chart-label">SOPs by Status</div>
      <DonutChart slices={byStatus} />
      {byCategory.length > 0 && (
        <>
          <div className="gm-chart-label" style={{ marginTop: 16 }}>Documented by Category</div>
          <div className="gm-gauge-list">
            {byCategory.map((c) => {
              const pct = c.sops ? Math.round((c.published / c.sops) * 100) : 0;
              return <div className="gm-gauge-row" key={c.label}>
                <div className="gm-gauge-top"><span className="gm-gauge-lbl">{c.label}</span><span className="gm-gauge-pct" style={{ color: pct === 100 ? "#1a9d5e" : "#b87200" }}>{c.published}/{c.sops}</span></div>
                <div className="gm-gauge-track"><div className="gm-gauge-fill" style={{ width: `${pct}%`, background: pct === 100 ? "#1a9d5e" : "#b87200" }} /></div>
              </div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

const GRAPH_META: Record<GraphType, { title: string; sub: string }> = {
  completion_trend: { title: "Completion Trend", sub: "SOPs published over 30 days" },
  category_breakdown: { title: "Library Breakdown", sub: "Status mix and category progress" },
};

export function GraphModal({ type, state, onClose }: GraphModalProps) {
  const meta = GRAPH_META[type];
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={`gm-backdrop ${visible ? "gm-backdrop--in" : ""}`}>
      <div className={`gm-panel ${visible ? "gm-panel--in" : ""}`} ref={ref} role="dialog" aria-modal="true" aria-label={meta.title}>
        <div className="gm-header">
          <div>
            <div className="gm-title">{meta.title}</div>
            <div className="gm-sub">{meta.sub}</div>
          </div>
          <button className="gm-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="gm-body">
          {type === "completion_trend" && <CompletionTrendGraph state={state} />}
          {type === "category_breakdown" && <CategoryBreakdownGraph state={state} />}
        </div>
      </div>
    </div>
  );
}

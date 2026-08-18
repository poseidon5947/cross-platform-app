import { useEffect, useRef, useState } from "react";
import type { CrewState } from "../types";
import { walletBalance } from "../domain/crew";

export type GraphType = "points_trend" | "leaderboard";

interface GraphModalProps {
  type: GraphType;
  state: CrewState;
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

function BarChart({ bars, height = 100 }: { bars: { label: string; value: number; color: string }[]; height?: number }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="gm-barchart">
      {bars.map((b, i) => (
        <div key={i} className="gm-bar-col">
          <div className="gm-bar-track">
            <div className="gm-bar-fill" style={{ height: `${Math.max(4, (b.value / max) * height)}px`, background: b.color }} />
          </div>
          <div className="gm-bar-val">{b.value}</div>
          <div className="gm-bar-lbl">{b.label}</div>
        </div>
      ))}
    </div>
  );
}

const BAR_COLORS = ["#14a2a4", "#0b6ea8", "#b87200", "#5b4ac2", "#c53030", "#1a9d5e"];

function PointsTrendGraph({ state }: { state: CrewState }) {
  const days = last30Days();
  const byDay = days.map((d) => state.pointsEvents.filter((e) => e.ts.slice(0, 10) === d).reduce((s, e) => s + e.points, 0));
  const total30 = byDay.reduce((s, v) => s + v, 0);
  const labels = [days[0], days[14], days[29]].map(dateLabel);
  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val">{total30}</div><div className="gm-stat-lbl">Points (30d)</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{state.pointsEvents.length}</div><div className="gm-stat-lbl">Total events</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{state.users.length}</div><div className="gm-stat-lbl">Team members</div></div>
      </div>
      <div className="gm-chart-label">Points Earned — Last 30 Days</div>
      <div className="gm-sparkwrap">
        <Sparkline points={byDay} color="#14a2a4" />
        <div className="gm-x-labels">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
      </div>
    </div>
  );
}

function LeaderboardGraph({ state }: { state: CrewState }) {
  const ranked = state.users
    .map((user) => ({ user, balance: walletBalance(state.pointsEvents, user.id) }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 6);
  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val">{ranked[0]?.balance ?? 0}</div><div className="gm-stat-lbl">Top balance</div></div>
        <div className="gm-stat wide"><div className="gm-stat-val">{ranked[0]?.user.name ?? "-"}</div><div className="gm-stat-lbl">Current leader</div></div>
      </div>
      <div className="gm-chart-label">Wallet Balance — Top {ranked.length}</div>
      <BarChart bars={ranked.map((r, i) => ({ label: r.user.name.split(" ")[0], value: r.balance, color: BAR_COLORS[i % BAR_COLORS.length] }))} />
    </div>
  );
}

const GRAPH_META: Record<GraphType, { title: string; sub: string }> = {
  points_trend: { title: "Points Trend", sub: "Points earned across the team over 30 days" },
  leaderboard: { title: "Leaderboard", sub: "Wallet balance ranking" },
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
          {type === "points_trend" && <PointsTrendGraph state={state} />}
          {type === "leaderboard" && <LeaderboardGraph state={state} />}
        </div>
      </div>
    </div>
  );
}

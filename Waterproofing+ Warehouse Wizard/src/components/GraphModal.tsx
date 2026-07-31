import React, { useEffect, useRef, useState } from 'react';
import type { AppState, Material } from '../types';

// ─── Types ────────────────────────────────────────────────
export type GraphType =
  | 'inventory_stock'
  | 'activity_trend'
  | 'tools_status'
  | 'crew_points'
  | 'reorder_alert'
  | 'losses_30d';

interface GraphModalProps {
  type: GraphType;
  state: AppState;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────
function money(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}

function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

function dateLabel(iso: string, short = true) {
  const d = new Date(iso);
  return short
    ? d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── SVG Chart Primitives ─────────────────────────────────
interface SparkProps {
  points: number[];
  color: string;
  fill?: boolean;
  width?: number;
  height?: number;
}

function Sparkline({ points, color, fill = true, width = 300, height = 80 }: SparkProps) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = max - min || 1;
  const pad = 4;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (width - pad * 2));
  const ys = points.map(v => pad + (1 - (v - min) / range) * (height - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${height} L${xs[0].toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {fill && <path d={area} fill={color} opacity={0.12} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 4 : 0} fill={color} />
      ))}
    </svg>
  );
}

interface BarProps {
  bars: { label: string; value: number; color: string }[];
  maxValue?: number;
  height?: number;
}

function BarChart({ bars, maxValue, height = 120 }: BarProps) {
  const max = maxValue ?? Math.max(...bars.map(b => b.value), 1);
  return (
    <div className="gm-barchart">
      {bars.map((b, i) => (
        <div key={i} className="gm-bar-col">
          <div className="gm-bar-track">
            <div
              className="gm-bar-fill"
              style={{
                height: `${Math.max(4, (b.value / max) * height)}px`,
                background: b.color,
              }}
            />
          </div>
          <div className="gm-bar-val">{b.value}</div>
          <div className="gm-bar-lbl">{b.label}</div>
        </div>
      ))}
    </div>
  );
}

interface DonutProps {
  slices: { label: string; value: number; color: string }[];
  size?: number;
}

function DonutChart({ slices, size = 110 }: DonutProps) {
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const cx = size / 2, cy = size / 2, r = size * 0.38, inner = size * 0.24;
  let angle = -Math.PI / 2;
  const paths = slices.map(sl => {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const ix1 = cx + inner * Math.cos(angle - sweep);
    const iy1 = cy + inner * Math.sin(angle - sweep);
    const ix2 = cx + inner * Math.cos(angle);
    const iy2 = cy + inner * Math.sin(angle);
    return { d: `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${inner},${inner} 0 ${large} 0 ${ix1.toFixed(2)},${iy1.toFixed(2)} Z`, color: sl.color, label: sl.label, value: sl.value };
  });
  return (
    <div className="gm-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth={1.5} />
        ))}
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

interface GaugeProps {
  pct: number;
  label: string;
  color: string;
  size?: number;
}

function GaugeBar({ pct, label, color, size: _size }: GaugeProps) {
  return (
    <div className="gm-gauge-row">
      <div className="gm-gauge-top">
        <span className="gm-gauge-lbl">{label}</span>
        <span className="gm-gauge-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="gm-gauge-track">
        <div className="gm-gauge-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Graph content renderers ───────────────────────────────

function ActivityTrendGraph({ state }: { state: AppState }) {
  const days = last30Days();
  const useByDay = days.map(d =>
    state.transactions.filter(t => t.ts.slice(0, 10) === d && t.type === 'use').reduce((s, t) => s + t.qty, 0)
  );
  const deliverByDay = days.map(d =>
    state.transactions.filter(t => t.ts.slice(0, 10) === d && t.type === 'deliver').reduce((s, t) => s + t.qty, 0)
  );
  const lossByDay = days.map(d =>
    state.transactions.filter(t => t.ts.slice(0, 10) === d && t.type === 'loss').reduce((s, t) => s + t.qty, 0)
  );
  const labels = [days[0], days[7], days[14], days[21], days[29]].map(d => dateLabel(d));
  const totalUse = useByDay.reduce((s, v) => s + v, 0);
  const totalLoss = lossByDay.reduce((s, v) => s + v, 0);

  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val">{totalUse}</div><div className="gm-stat-lbl">Units used (30d)</div></div>
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#b87200' }}>{totalLoss}</div><div className="gm-stat-lbl">Loss events</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{state.transactions.length}</div><div className="gm-stat-lbl">Total logs</div></div>
      </div>
      <div className="gm-chart-label">Units Used — Last 30 Days</div>
      <div className="gm-sparkwrap">
        <Sparkline points={useByDay} color="#0b6ea8" width={320} height={90} />
        <div className="gm-x-labels">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      </div>
      <div className="gm-chart-label" style={{ marginTop: 16 }}>Deliveries — Last 30 Days</div>
      <div className="gm-sparkwrap">
        <Sparkline points={deliverByDay} color="#1a9d5e" width={320} height={70} />
      </div>
    </div>
  );
}

function InventoryStockGraph({ state }: { state: AppState }) {
  const sorted = [...state.materials].sort((a, b) => {
    const pa = a.qty / Math.max(a.reorderPoint, 1);
    const pb = b.qty / Math.max(b.reorderPoint, 1);
    return pa - pb;
  }).slice(0, 12);

  const totalValue = state.materials.reduce((s, m) => s + m.qty * m.cost, 0);
  const belowReorder = state.materials.filter(m => m.qty <= m.reorderPoint).length;
  const outOfStock  = state.materials.filter(m => m.qty === 0).length;

  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val">{state.materials.length}</div><div className="gm-stat-lbl">SKUs tracked</div></div>
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#b87200' }}>{belowReorder}</div><div className="gm-stat-lbl">Below reorder</div></div>
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#c53030' }}>{outOfStock}</div><div className="gm-stat-lbl">Out of stock</div></div>
      </div>
      <div className="gm-stat-row" style={{ marginTop: 0 }}>
        <div className="gm-stat wide"><div className="gm-stat-val">{money(totalValue)}</div><div className="gm-stat-lbl">Total inventory value</div></div>
      </div>
      <div className="gm-chart-label">Stock Level vs Reorder Point — Lowest 12</div>
      <div className="gm-gauge-list">
        {sorted.map(m => {
          const pct = Math.min(100, Math.round((m.qty / Math.max(m.reorderPoint * 1.5, 1)) * 100));
          const color = pct >= 80 ? '#1a9d5e' : pct >= 40 ? '#b87200' : '#c53030';
          return <GaugeBar key={m.id} pct={pct} label={m.name} color={color} />;
        })}
      </div>
    </div>
  );
}

function ToolsStatusGraph({ state }: { state: AppState }) {
  const out      = state.tools.filter(t => t.status === 'out').length;
  const inWh     = state.tools.filter(t => t.status === 'in').length;
  const damaged  = state.tools.filter(t => t.condition === 'damaged').length;
  const repair   = state.tools.filter(t => t.condition === 'repair').length;
  const good     = state.tools.filter(t => t.condition === 'good').length;
  const battDue  = state.tools.filter(t => t.battery && t.lastCharged == null).length;

  const serviceBreakdown = state.services.map(svc => ({
    label: svc.short,
    value: state.tools.filter(t => t.serviceId === svc.id).length,
    color: ['#0b6ea8', '#1a9d5e', '#b87200', '#5b4ac2', '#c53030'][state.services.indexOf(svc) % 5],
  })).filter(s => s.value > 0);

  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val">{state.tools.length}</div><div className="gm-stat-lbl">Total tools</div></div>
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#b87200' }}>{out}</div><div className="gm-stat-lbl">Checked out</div></div>
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#c53030' }}>{damaged + repair}</div><div className="gm-stat-lbl">Need attention</div></div>
      </div>
      <div className="gm-two-col">
        <div className="gm-donut-block">
          <div className="gm-chart-label">Check-out Status</div>
          <DonutChart size={100} slices={[
            { label: 'In warehouse', value: inWh,  color: '#1a9d5e' },
            { label: 'Checked out',  value: out,   color: '#b87200' },
          ]} />
        </div>
        <div className="gm-donut-block">
          <div className="gm-chart-label">Condition</div>
          <DonutChart size={100} slices={[
            { label: 'Good',    value: good,    color: '#1a9d5e' },
            { label: 'Repair',  value: repair,  color: '#b87200' },
            { label: 'Damaged', value: damaged, color: '#c53030' },
          ]} />
        </div>
      </div>
      <div className="gm-chart-label" style={{ marginTop: 16 }}>Tools by Service</div>
      <BarChart bars={serviceBreakdown} height={90} />
      {battDue > 0 && (
        <div className="gm-alert-row">
          <span className="gm-alert-dot" />
          {battDue} battery tool{battDue > 1 ? 's' : ''} never charged — check before dispatch
        </div>
      )}
    </div>
  );
}

function CrewPointsGraph({ state }: { state: AppState }) {
  const days = last30Days();
  const ranked = [...state.users].map(u => {
    const earned = state.pointsEvents.filter(e => e.userId === u.id).reduce((s, e) => s + e.points, 0);
    return { ...u, total: u.points + earned };
  }).sort((a, b) => b.total - a.total);

  const pointsByDay = days.map(d =>
    state.pointsEvents.filter(e => e.ts.slice(0, 10) === d).reduce((s, e) => s + e.points, 0)
  );
  const streakUser = state.streaks.reduce((best, s) => (!best || s.count > best.count) ? s : best, null as typeof state.streaks[0] | null);
  const streakName = streakUser ? state.users.find(u => u.id === streakUser.userId)?.name ?? '—' : '—';

  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val">{ranked[0]?.total ?? 0}</div><div className="gm-stat-lbl">Top score</div></div>
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#9a6200' }}>{streakUser?.count ?? 0}</div><div className="gm-stat-lbl">Best streak</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{state.pointsEvents.length}</div><div className="gm-stat-lbl">Total events</div></div>
      </div>
      <div className="gm-chart-label">Points Earned — Last 30 Days</div>
      <div className="gm-sparkwrap">
        <Sparkline points={pointsByDay} color="#5b4ac2" width={320} height={80} />
        <div className="gm-x-labels">
          {[days[0], days[14], days[29]].map((d, i) => <span key={i}>{dateLabel(d)}</span>)}
        </div>
      </div>
      <div className="gm-chart-label" style={{ marginTop: 16 }}>Leaderboard</div>
      <BarChart height={80} bars={ranked.slice(0, 6).map((u, i) => ({
        label: u.name.split(' ')[0],
        value: u.total,
        color: ['#0b6ea8', '#1a9d5e', '#b87200', '#5b4ac2', '#c53030', '#2b8a8a'][i],
      }))} />
      {streakUser && (
        <div className="gm-insight-row">
          🔥 {streakName} has the longest streak — {streakUser.count} day{streakUser.count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

function Losses30dGraph({ state }: { state: AppState }) {
  const cutoff = Date.now() - 30 * 86400000;
  const losses = state.transactions.filter(t => t.type === 'loss' && new Date(t.ts).getTime() > cutoff);
  const total  = losses.reduce((s, t) => s + t.qty * (state.materials.find(m => m.id === t.materialId)?.cost ?? 0), 0);

  const byMaterial = state.materials.map(m => {
    const qty  = losses.filter(t => t.materialId === m.id).reduce((s, t) => s + t.qty, 0);
    const cost = qty * m.cost;
    return { label: m.name, qty, cost };
  }).filter(x => x.qty > 0).sort((a, b) => b.cost - a.cost).slice(0, 8);

  const days = last30Days();
  const lossByDay = days.map(d =>
    state.transactions.filter(t => t.type === 'loss' && t.ts.slice(0, 10) === d)
      .reduce((s, t) => s + t.qty * (state.materials.find(m => m.id === t.materialId)?.cost ?? 0), 0)
  );

  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#c53030' }}>{money(total)}</div><div className="gm-stat-lbl">Loss value (30d)</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{losses.length}</div><div className="gm-stat-lbl">Loss events</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{byMaterial.length}</div><div className="gm-stat-lbl">SKUs affected</div></div>
      </div>
      <div className="gm-chart-label">Loss Cost Trend — Last 30 Days</div>
      <div className="gm-sparkwrap">
        <Sparkline points={lossByDay} color="#c53030" width={320} height={80} />
      </div>
      {byMaterial.length > 0 && (
        <>
          <div className="gm-chart-label" style={{ marginTop: 16 }}>Top Loss Materials</div>
          <div className="gm-gauge-list">
            {byMaterial.map((m, i) => (
              <GaugeBar key={i} pct={Math.round((m.cost / (total || 1)) * 100)} label={`${m.label} (${m.qty} units)`} color="#c53030" />
            ))}
          </div>
        </>
      )}
      {byMaterial.length === 0 && (
        <div className="gm-empty">No losses recorded in the last 30 days. 🎉</div>
      )}
    </div>
  );
}

function ReorderAlertGraph({ state }: { state: AppState }) {
  const lows = state.materials.filter(m => m.qty <= m.reorderPoint).sort((a, b) => (a.qty / Math.max(a.reorderPoint, 1)) - (b.qty / Math.max(b.reorderPoint, 1)));
  const critical = lows.filter(m => m.qty === 0);
  const subtotal  = lows.reduce((s, m) => s + Math.max(0, m.reorderPoint - m.qty) * m.cost, 0);

  return (
    <div className="gm-content">
      <div className="gm-stat-row">
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#c53030' }}>{critical.length}</div><div className="gm-stat-lbl">Out of stock</div></div>
        <div className="gm-stat"><div className="gm-stat-val" style={{ color: '#b87200' }}>{lows.length}</div><div className="gm-stat-lbl">Below reorder</div></div>
        <div className="gm-stat"><div className="gm-stat-val">{money(subtotal)}</div><div className="gm-stat-lbl">Est. reorder cost</div></div>
      </div>
      <div className="gm-chart-label">Stock Level — Items at Risk</div>
      <div className="gm-gauge-list">
        {lows.slice(0, 10).map(m => {
          const pct = Math.min(100, Math.round((m.qty / Math.max(m.reorderPoint, 1)) * 100));
          const color = m.qty === 0 ? '#c53030' : '#b87200';
          return <GaugeBar key={m.id} pct={pct} label={`${m.name} — ${m.qty} ${m.unit} (need ${m.reorderPoint})`} color={color} />;
        })}
      </div>
      {lows.length === 0 && <div className="gm-empty">All items are above reorder threshold. ✓</div>}
    </div>
  );
}

// ─── Graph title / description map ────────────────────────
const GRAPH_META: Record<GraphType, { title: string; sub: string }> = {
  activity_trend:   { title: 'Activity Trend',       sub: 'Material usage, deliveries & losses over 30 days' },
  inventory_stock:  { title: 'Inventory Health',     sub: 'Stock levels vs reorder thresholds' },
  tools_status:     { title: 'Tools & Equipment',    sub: 'Status, condition & service breakdown' },
  crew_points:      { title: 'Crew Performance',     sub: 'Points, streaks & leaderboard' },
  reorder_alert:    { title: 'Reorder Alerts',       sub: 'Items at or below reorder point' },
  losses_30d:       { title: 'Loss Report',           sub: 'Damaged & spilled materials — last 30 days' },
};

// ─── Main export ──────────────────────────────────────────
export function GraphModal({ type, state, onClose }: GraphModalProps) {
  const meta = GRAPH_META[type];
  const ref  = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className={`gm-backdrop ${visible ? 'gm-backdrop--in' : ''}`}>
      <div className={`gm-panel ${visible ? 'gm-panel--in' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={meta.title}>
        {/* Header */}
        <div className="gm-header">
          <div>
            <div className="gm-title">{meta.title}</div>
            <div className="gm-sub">{meta.sub}</div>
          </div>
          <button className="gm-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="gm-body">
          {type === 'activity_trend'  && <ActivityTrendGraph  state={state} />}
          {type === 'inventory_stock' && <InventoryStockGraph state={state} />}
          {type === 'tools_status'    && <ToolsStatusGraph    state={state} />}
          {type === 'crew_points'     && <CrewPointsGraph     state={state} />}
          {type === 'reorder_alert'   && <ReorderAlertGraph   state={state} />}
          {type === 'losses_30d'      && <Losses30dGraph      state={state} />}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import type {
  UIStyle, BtnShape, BtnStyle, BtnHover, BtnSize,
  IconStyle, IconAnim, CardStyle, NavStyle, FontScale, AnimSpeed,
} from '../uiStyle';

interface UIStyleEditorProps {
  value: UIStyle;
  onChange: (next: UIStyle) => void;
  onClose: () => void;
}

export function UIStyleEditor({ value, onChange, onClose }: UIStyleEditorProps) {
  const set = <K extends keyof UIStyle>(key: K, val: UIStyle[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="use-editor">

      {/* ── Button Shape ── */}
      <Section title="Button Shape">
        <OptionRow>
          {([
            { id: 'pill',    label: 'Pill',    icon: '◯' },
            { id: 'rounded', label: 'Rounded', icon: '▢' },
            { id: 'soft',    label: 'Soft',    icon: '□' },
            { id: 'sharp',   label: 'Sharp',   icon: '■' },
          ] as { id: BtnShape; label: string; icon: string }[]).map(o => (
            <ShapeCard
              key={o.id} id={o.id} label={o.label} icon={o.icon}
              active={value.btnShape === o.id}
              onClick={() => set('btnShape', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Button Style / Fill ── */}
      <Section title="Button Fill">
        <OptionRow>
          {([
            { id: 'gradient', label: 'Gradient', preview: 'use-prev-gradient' },
            { id: 'solid',    label: 'Solid',    preview: 'use-prev-solid'    },
            { id: 'outline',  label: 'Outline',  preview: 'use-prev-outline'  },
            { id: 'ghost',    label: 'Ghost',    preview: 'use-prev-ghost'    },
            { id: 'glass',    label: 'Glass',    preview: 'use-prev-glass'    },
          ] as { id: BtnStyle; label: string; preview: string }[]).map(o => (
            <StyleCard
              key={o.id} id={o.id} label={o.label} preview={o.preview}
              active={value.btnStyle === o.id}
              onClick={() => set('btnStyle', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Hover Effect ── */}
      <Section title="Hover Effect">
        <OptionRow wrap>
          {([
            { id: 'lift',   label: 'Lift ↑',     desc: 'Floats up' },
            { id: 'glow',   label: 'Glow ✦',     desc: 'Color aura' },
            { id: 'scale',  label: 'Scale ↔',    desc: 'Grows' },
            { id: 'slide',  label: 'Slide →',    desc: 'Shifts right' },
            { id: 'ripple', label: 'Ripple ◎',   desc: 'Wave burst' },
            { id: 'none',   label: 'None',       desc: 'Static' },
          ] as { id: BtnHover; label: string; desc: string }[]).map(o => (
            <HoverCard
              key={o.id} id={o.id} label={o.label} desc={o.desc}
              active={value.btnHover === o.id}
              onClick={() => set('btnHover', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Button Size ── */}
      <Section title="Button Size">
        <OptionRow>
          {([
            { id: 'compact',     label: 'Compact',     h: '38px' },
            { id: 'default',     label: 'Default',     h: '48px' },
            { id: 'comfortable', label: 'Comfortable', h: '54px' },
            { id: 'large',       label: 'Large',       h: '60px' },
          ] as { id: BtnSize; label: string; h: string }[]).map(o => (
            <SizeCard
              key={o.id} id={o.id} label={o.label} height={o.h}
              active={value.btnSize === o.id}
              onClick={() => set('btnSize', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Icon Style ── */}
      <Section title="Icon Style">
        <OptionRow>
          {([
            { id: 'outline',  label: 'Outline',  svg: <OutlineIcon /> },
            { id: 'filled',   label: 'Filled',   svg: <FilledIcon />  },
            { id: 'duotone',  label: 'Duotone',  svg: <DuotoneIcon /> },
            { id: 'none',     label: 'No Icons', svg: <span style={{fontSize:18}}>—</span> },
          ] as { id: IconStyle; label: string; svg: React.ReactNode }[]).map(o => (
            <IconCard
              key={o.id} id={o.id} label={o.label} svg={o.svg}
              active={value.iconStyle === o.id}
              onClick={() => set('iconStyle', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Icon Animation ── */}
      <Section title="Icon Animation">
        <OptionRow wrap>
          {([
            { id: 'none',   label: 'None'   },
            { id: 'spin',   label: 'Spin'   },
            { id: 'bounce', label: 'Bounce' },
            { id: 'pulse',  label: 'Pulse'  },
            { id: 'shake',  label: 'Shake'  },
          ] as { id: IconAnim; label: string }[]).map(o => (
            <ToggleChip
              key={o.id} label={o.label}
              active={value.iconAnim === o.id}
              onClick={() => set('iconAnim', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Card Style ── */}
      <Section title="Card Style">
        <OptionRow>
          {([
            { id: 'glass',  label: 'Glass',  desc: 'Blur + tint'   },
            { id: 'solid',  label: 'Solid',  desc: 'Flat fill'     },
            { id: 'border', label: 'Border', desc: 'Line only'     },
            { id: 'flat',   label: 'Flat',   desc: 'No border'     },
          ] as { id: CardStyle; label: string; desc: string }[]).map(o => (
            <HoverCard
              key={o.id} id={o.id} label={o.label} desc={o.desc}
              active={value.cardStyle === o.id}
              onClick={() => set('cardStyle', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Nav Style ── */}
      <Section title="Bottom Nav Style">
        <OptionRow wrap>
          {([
            { id: 'pill',      label: 'Pill',      desc: 'Rounded pill bg'  },
            { id: 'underline', label: 'Underline', desc: 'Bottom indicator' },
            { id: 'icon-only', label: 'Icons Only', desc: 'No labels'       },
            { id: 'full',      label: 'Full',      desc: 'Label + bg'       },
          ] as { id: NavStyle; label: string; desc: string }[]).map(o => (
            <HoverCard
              key={o.id} id={o.id} label={o.label} desc={o.desc}
              active={value.navStyle === o.id}
              onClick={() => set('navStyle', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Font Scale ── */}
      <Section title="Font Scale">
        <OptionRow>
          {([
            { id: 'xs', label: 'XS', sample: 12 },
            { id: 'sm', label: 'SM', sample: 13 },
            { id: 'md', label: 'MD', sample: 15 },
            { id: 'lg', label: 'LG', sample: 17 },
          ] as { id: FontScale; label: string; sample: number }[]).map(o => (
            <FontCard
              key={o.id} id={o.id} label={o.label} sample={o.sample}
              active={value.fontScale === o.id}
              onClick={() => set('fontScale', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Animation Speed ── */}
      <Section title="Animation Speed">
        <OptionRow>
          {([
            { id: 'instant', label: 'Instant', ms: '0ms'  },
            { id: 'fast',    label: 'Fast',    ms: '100ms' },
            { id: 'normal',  label: 'Normal',  ms: '220ms' },
            { id: 'slow',    label: 'Slow',    ms: '400ms' },
          ] as { id: AnimSpeed; label: string; ms: string }[]).map(o => (
            <HoverCard
              key={o.id} id={o.id} label={o.label} desc={o.ms}
              active={value.animSpeed === o.id}
              onClick={() => set('animSpeed', o.id)}
            />
          ))}
        </OptionRow>
      </Section>

      {/* ── Shadow level ── */}
      <Section title={`Shadow Intensity — Level ${value.shadowLevel}`}>
        <input
          type="range" min={0} max={4} step={1}
          value={value.shadowLevel}
          onChange={e => set('shadowLevel', Number(e.target.value))}
          className="use-slider"
        />
        <div className="use-slider-labels">
          <span>None</span><span>Low</span><span>Mid</span><span>High</span><span>Max</span>
        </div>
      </Section>

      {/* ── Live preview ── */}
      <Section title="Live Preview">
        <LivePreview value={value} />
      </Section>

      {/* ── Actions ── */}
      <div className="use-actions">
        <button className="btn good block" onClick={onClose}>Apply & Close</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="use-section">
      <div className="use-section-title">{title}</div>
      {children}
    </div>
  );
}

function OptionRow({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return <div className={`use-option-row ${wrap ? 'wrap' : ''}`}>{children}</div>;
}

function ShapeCard({ id, label, icon, active, onClick }: { id: string; label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`use-card shape-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="use-shape-icon" style={{
        borderRadius: id === 'pill' ? '999px' : id === 'rounded' ? '12px' : id === 'soft' ? '6px' : '2px',
      }}>{icon}</span>
      <span className="use-card-label">{label}</span>
    </button>
  );
}

function StyleCard({ id, label, preview, active, onClick }: { id: string; label: string; preview: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`use-card style-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className={`use-style-prev ${preview}`}>{label}</span>
      <span className="use-card-label">{label}</span>
    </button>
  );
}

function HoverCard({ id, label, desc, active, onClick }: { id: string; label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`use-card hover-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="use-card-main">{label}</span>
      <span className="use-card-desc">{desc}</span>
    </button>
  );
}

function SizeCard({ id, label, height, active, onClick }: { id: string; label: string; height: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`use-card size-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="use-size-bar" style={{ height }} />
      <span className="use-card-label">{label}</span>
    </button>
  );
}

function IconCard({ id, label, svg, active, onClick }: { id: string; label: string; svg: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button className={`use-card icon-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="use-icon-prev">{svg}</span>
      <span className="use-card-label">{label}</span>
    </button>
  );
}

function FontCard({ id, label, sample, active, onClick }: { id: string; label: string; sample: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`use-card font-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="use-font-sample" style={{ fontSize: sample }}>Aa</span>
      <span className="use-card-label">{label}</span>
    </button>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`use-toggle-chip ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

// Icon samples
function OutlineIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg>;
}
function FilledIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 14.5-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z"/></svg>;
}
function DuotoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity=".25"/>
      <path d="M12 8v4l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// Live button preview panel
function LivePreview({ value }: { value: UIStyle }) {
  const radius = value.btnShape === 'pill' ? '999px' : value.btnShape === 'rounded' ? '12px' : value.btnShape === 'soft' ? '6px' : '3px';
  const pad    = value.btnSize === 'compact' ? '8px 14px' : value.btnSize === 'large' ? '16px 26px' : value.btnSize === 'comfortable' ? '14px 22px' : '11px 18px';
  const font   = value.btnSize === 'compact' ? 13 : value.btnSize === 'large' ? 17 : 15;
  const dur    = value.animSpeed === 'instant' ? 0 : value.animSpeed === 'fast' ? 100 : value.animSpeed === 'slow' ? 400 : 200;

  const baseStyle: React.CSSProperties = {
    borderRadius: radius,
    padding: pad,
    fontSize: font,
    fontWeight: 800,
    cursor: 'pointer',
    transition: `all ${dur}ms cubic-bezier(.4,0,.2,1)`,
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  };

  const getStyle = (type: 'primary' | 'outline' | 'ghost'): React.CSSProperties => {
    if (value.btnStyle === 'gradient') {
      if (type === 'primary') return { ...baseStyle, background: 'linear-gradient(135deg,var(--primary),var(--amber))', color: '#fff' };
      if (type === 'outline')  return { ...baseStyle, background: 'transparent', border: '2px solid var(--primary)', color: 'var(--primary)' };
      return { ...baseStyle, background: 'transparent', color: 'var(--primary)' };
    }
    if (value.btnStyle === 'solid') {
      if (type === 'primary') return { ...baseStyle, background: 'var(--primary)', color: '#fff' };
      if (type === 'outline')  return { ...baseStyle, background: 'transparent', border: '2px solid var(--line-2)', color: 'var(--ink)' };
      return { ...baseStyle, background: 'transparent', color: 'var(--ink-2)' };
    }
    if (value.btnStyle === 'outline') {
      return { ...baseStyle, background: 'transparent', border: '2px solid var(--primary)', color: 'var(--primary)' };
    }
    if (value.btnStyle === 'glass') {
      return { ...baseStyle, background: 'var(--primary-dim)', border: '1px solid var(--primary)', color: 'var(--primary)', backdropFilter: 'blur(12px)' };
    }
    // ghost
    return { ...baseStyle, background: 'var(--primary-dim)', color: 'var(--primary)' };
  };

  return (
    <div className="use-live-preview">
      <div className="ulp-row">
        <button style={getStyle('primary')} className={`use-demo-btn ${value.btnHover}`}>Primary</button>
        <button style={getStyle('outline')} className={`use-demo-btn ${value.btnHover}`}>Outline</button>
        <button style={getStyle('ghost')}   className={`use-demo-btn ${value.btnHover}`}>Ghost</button>
      </div>
      <div className="ulp-row" style={{ marginTop: 12 }}>
        <button style={{ ...getStyle('primary'), background: 'linear-gradient(135deg,var(--good),#00c870)', borderRadius: radius }} className={`use-demo-btn ${value.btnHover}`}>
          {value.iconStyle !== 'none' && <OutlineIcon />} Success
        </button>
        <button style={{ ...getStyle('primary'), background: 'linear-gradient(135deg,var(--bad),#ff6b80)', borderRadius: radius }} className={`use-demo-btn ${value.btnHover}`}>
          Danger
        </button>
      </div>
    </div>
  );
}

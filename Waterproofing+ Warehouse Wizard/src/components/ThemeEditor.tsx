import React, { useState } from 'react';
import type { Theme } from '../themes';
import { themes, applyTheme, saveTheme } from '../themes';

interface ThemeEditorProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}

/** Convert a hex colour to rgba(r,g,b,alpha) string */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Auto-derive dim/glow variants from a hex color */
function deriveVariants(hex: string, dimAlpha = 0.14, glowAlpha = 0.35) {
  return {
    dim: hexToRgba(hex, dimAlpha),
    glow: hexToRgba(hex, glowAlpha),
  };
}

/** Show banner toast outside React tree */
function flashToast(msg: string) {
  const el = document.createElement('div');
  el.className = 'theme-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('show'));
  });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 1900);
}

export function ThemeEditor({ currentTheme, onThemeChange, onClose }: ThemeEditorProps) {
  const [selectedId, setSelectedId] = useState(currentTheme.id);
  const [customTheme, setCustomTheme] = useState<Theme>({ ...currentTheme });
  const [editMode, setEditMode] = useState(false);

  /* ── Switch to a preset ── */
  const selectPreset = (themeId: string) => {
    const theme = themes[themeId];
    setSelectedId(themeId);
    setCustomTheme({ ...theme });
    setEditMode(false);
    applyTheme(theme);
    saveTheme(theme);
    onThemeChange(theme);
    flashToast(`✓ ${theme.name} applied`);
  };

  /* ── Update one color key and re-derive its dim/glow ── */
  const updateColor = (key: keyof Theme['colors'], hex: string) => {
    let patch: Partial<Theme['colors']> = { [key]: hex };

    // Auto-derive companion vars for main colour keys
    const derivedMap: Record<string, { dim: keyof Theme['colors']; glow?: keyof Theme['colors'] }> = {
      primary: { dim: 'primaryDim', glow: 'primaryGlow' },
      amber:   { dim: 'amberDim',   glow: 'amberGlow'  },
      good:    { dim: 'goodDim',    glow: 'goodGlow'   },
      warn:    { dim: 'warnDim'                        },
      bad:     { dim: 'badDim',     glow: 'badGlow'    },
      purple:  { dim: 'purpleDim'                      },
    };
    if (derivedMap[key]) {
      const { dim, glow } = derivedMap[key];
      const { dim: dVal, glow: gVal } = deriveVariants(hex);
      patch[dim] = dVal;
      if (glow) patch[glow] = gVal;
    }

    const updated: Theme = {
      ...customTheme,
      id: 'custom',
      name: 'Custom',
      colors: { ...customTheme.colors, ...patch },
    };
    setCustomTheme(updated);
    applyTheme(updated);
  };

  /* ── Commit to storage ── */
  const saveCustom = () => {
    const theme: Theme = { ...customTheme, id: 'custom', name: 'Custom' };
    setSelectedId('custom');
    saveTheme(theme);
    onThemeChange(theme);
    flashToast('✓ Custom theme saved');
  };

  const resetToDefault = () => {
    selectPreset('waterproofing');
  };

  return (
    <div className="theme-editor">

      {/* ── Preset grid ── */}
      <div className="theme-presets">
        <p className="fld">Preset themes</p>
        <div className="preset-grid">
          {Object.values(themes).map((t) => (
            <button
              key={t.id}
              className={`preset-card ${selectedId === t.id && !editMode ? 'active' : ''}`}
              onClick={() => selectPreset(t.id)}
            >
              <div className="preset-swatches">
                <span className="ps" style={{ background: t.colors.bg2, border: `2px solid ${t.colors.primary}` }} />
                <div className="ps-dots">
                  <span style={{ background: t.colors.primary }} />
                  <span style={{ background: t.colors.amber }} />
                  <span style={{ background: t.colors.good }} />
                  <span style={{ background: t.colors.purple }} />
                </div>
              </div>
              <span className="preset-name">{t.name}</span>
              {selectedId === t.id && !editMode && (
                <span className="preset-active-badge">✓ Active</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Custom editor toggle ── */}
      <div className="theme-custom">
        <div className="custom-header">
          <p className="fld" style={{ margin: 0 }}>Custom editor</p>
          <button
            className="btn line sm"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? '↑ Close' : '✏ Edit colors'}
          </button>
        </div>

        {editMode && (
          <div className="color-editor">

            <ColorSection title="Brand">
              <ColorRow label="Primary" colorKey="primary" value={customTheme.colors.primary} onChange={updateColor} />
              <ColorRow label="Primary Dark" colorKey="primaryD" value={customTheme.colors.primaryD} onChange={updateColor} />
              <ColorRow label="Amber Accent" colorKey="amber" value={customTheme.colors.amber} onChange={updateColor} />
              <ColorRow label="Purple" colorKey="purple" value={customTheme.colors.purple} onChange={updateColor} />
            </ColorSection>

            <ColorSection title="Status">
              <ColorRow label="Success" colorKey="good" value={customTheme.colors.good} onChange={updateColor} />
              <ColorRow label="Warning" colorKey="warn" value={customTheme.colors.warn} onChange={updateColor} />
              <ColorRow label="Danger" colorKey="bad" value={customTheme.colors.bad} onChange={updateColor} />
            </ColorSection>

            <ColorSection title="Background">
              <ColorRow label="Base" colorKey="bg" value={customTheme.colors.bg} onChange={updateColor} />
              <ColorRow label="Layer 2" colorKey="bg2" value={customTheme.colors.bg2} onChange={updateColor} />
              <ColorRow label="Layer 3" colorKey="bg3" value={customTheme.colors.bg3} onChange={updateColor} />
              <ColorRow label="Layer 4" colorKey="bg4" value={customTheme.colors.bg4} onChange={updateColor} />
            </ColorSection>

            <ColorSection title="Text">
              <ColorRow label="Primary" colorKey="ink" value={customTheme.colors.ink} onChange={updateColor} />
              <ColorRow label="Secondary" colorKey="ink2" value={customTheme.colors.ink2} onChange={updateColor} />
              <ColorRow label="Muted" colorKey="ink3" value={customTheme.colors.ink3} onChange={updateColor} />
            </ColorSection>

            {/* Live mini-preview */}
            <div className="live-preview">
              <p className="fld">Live preview</p>
              <div className="lp-card" style={{ background: customTheme.colors.bg2, border: `1px solid ${customTheme.colors.primary}44` }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[customTheme.colors.primary, customTheme.colors.amber, customTheme.colors.good, customTheme.colors.bad, customTheme.colors.purple].map((c, i) => (
                    <span key={i} className="lp-dot" style={{ background: c, boxShadow: `0 0 12px ${c}66` }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="lp-btn" style={{ background: customTheme.colors.primary, color: '#fff' }}>Primary</span>
                  <span className="lp-btn" style={{ background: customTheme.colors.bg4, color: customTheme.colors.ink2, border: `1px solid ${customTheme.colors.primary}44` }}>Outline</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: customTheme.colors.ink, marginBottom: 4 }}>Sample text</div>
                  <div style={{ fontSize: 12, color: customTheme.colors.ink2 }}>Secondary text color sample</div>
                  <div style={{ fontSize: 11, color: customTheme.colors.ink3, marginTop: 2 }}>Muted text sample</div>
                </div>
              </div>
            </div>

            <div className="editor-actions">
              <button className="btn primary block" onClick={saveCustom}>Save Custom Theme</button>
              <button className="btn line block" onClick={resetToDefault}>Reset to Waterproofing+ Default</button>
            </div>
          </div>
        )}
      </div>

      <button className="btn dark block" style={{ marginTop: 20 }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}

/* ── Sub-components ── */

function ColorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="color-section">
      <h5>{title}</h5>
      {children}
    </div>
  );
}

interface ColorRowProps {
  label: string;
  colorKey: keyof Theme['colors'];
  value: string;
  onChange: (key: keyof Theme['colors'], value: string) => void;
}

function ColorRow({ label, colorKey, value, onChange }: ColorRowProps) {
  // Extract the hex portion for the color picker (skip rgba values)
  const pickerVal = value.startsWith('#') && value.length >= 7 ? value.slice(0, 7) : '#000000';

  return (
    <div className="color-input">
      <label className="color-label">{label}</label>
      <div className="color-control">
        <input
          type="color"
          value={pickerVal}
          onChange={(e) => onChange(colorKey, e.target.value)}
          className="color-picker"
          title={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(colorKey, e.target.value)}
          className="color-text in"
          placeholder="#000000"
          spellCheck={false}
        />
        <span className="color-swatch" style={{ background: value.startsWith('rgba') ? 'transparent' : value }} />
      </div>
    </div>
  );
}

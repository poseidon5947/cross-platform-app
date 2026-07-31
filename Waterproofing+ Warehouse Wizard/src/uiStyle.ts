// ═══════════════════════════════════════════════════════════
//  UI STYLE SYSTEM — button shapes, hover effects, sizes, icons
// ═══════════════════════════════════════════════════════════

export type BtnShape   = 'rounded' | 'pill' | 'sharp' | 'soft';
export type BtnStyle   = 'gradient' | 'solid' | 'outline' | 'ghost' | 'glass';
export type BtnHover   = 'lift' | 'glow' | 'scale' | 'slide' | 'ripple' | 'none';
export type BtnSize    = 'compact' | 'default' | 'comfortable' | 'large';
export type IconStyle  = 'filled' | 'outline' | 'duotone' | 'none';
export type IconAnim   = 'none' | 'spin' | 'bounce' | 'pulse' | 'shake';
export type CardStyle  = 'glass' | 'solid' | 'border' | 'flat';
export type NavStyle   = 'pill' | 'underline' | 'icon-only' | 'full';
export type FontScale  = 'xs' | 'sm' | 'md' | 'lg';
export type AnimSpeed  = 'instant' | 'fast' | 'normal' | 'slow';

export interface UIStyle {
  // Button shape
  btnShape:   BtnShape;
  // Button fill style
  btnStyle:   BtnStyle;
  // Hover / active effect
  btnHover:   BtnHover;
  // Size scale
  btnSize:    BtnSize;
  // Icon appearance
  iconStyle:  IconStyle;
  iconAnim:   IconAnim;
  // Card style
  cardStyle:  CardStyle;
  // Bottom nav style
  navStyle:   NavStyle;
  // Global font scale
  fontScale:  FontScale;
  // Motion speed
  animSpeed:  AnimSpeed;
  // Shadow intensity 0–4
  shadowLevel: number;
}

export const defaultUIStyle: UIStyle = {
  btnShape:    'rounded',
  btnStyle:    'gradient',
  btnHover:    'lift',
  btnSize:     'default',
  iconStyle:   'outline',
  iconAnim:    'none',
  cardStyle:   'glass',
  navStyle:    'pill',
  fontScale:   'md',
  animSpeed:   'normal',
  shadowLevel: 2,
};

// ── CSS variable mappings ─────────────────────────────────

const SHAPE_RADIUS: Record<BtnShape, string> = {
  pill:    '999px',
  rounded: '8px',
  soft:    '6px',
  sharp:   '3px',
};

const SIZE_SCALE: Record<BtnSize, { pad: string; height: string; font: string; smPad: string }> = {
  compact:     { pad: '8px 14px',  height: '36px', font: '13px', smPad: '6px 10px' },
  default:     { pad: '11px 18px', height: '44px', font: '14px', smPad: '8px 14px' },
  comfortable: { pad: '13px 22px', height: '50px', font: '15px', smPad: '10px 16px' },
  large:       { pad: '15px 26px', height: '56px', font: '16px', smPad: '12px 18px' },
};

const FONT_SCALE: Record<FontScale, { base: string; sm: string; xs: string; lg: string }> = {
  xs: { base: '13px', sm: '12px', xs: '11px', lg: '15px' },
  sm: { base: '14px', sm: '13px', xs: '11px', lg: '16px' },
  md: { base: '15px', sm: '13px', xs: '12px', lg: '18px' },
  lg: { base: '17px', sm: '15px', xs: '13px', lg: '20px' },
};

const SPEED: Record<AnimSpeed, string> = {
  instant: '0ms',
  fast:    '100ms',
  normal:  '220ms',
  slow:    '400ms',
};

const SHADOW_LG: Record<number, string> = {
  0: 'none',
  1: '0 1px 3px rgba(19,33,53,.07)',
  2: '0 4px 12px rgba(19,33,53,.10)',
  3: '0 8px 24px rgba(19,33,53,.13)',
  4: '0 16px 40px rgba(19,33,53,.16)',
};

// ── Apply UIStyle → CSS custom properties ─────────────────

export function applyUIStyle(s: UIStyle): void {
  const root = document.documentElement;

  // Shape
  root.style.setProperty('--ui-btn-radius',   SHAPE_RADIUS[s.btnShape]);

  // Size
  const sz = SIZE_SCALE[s.btnSize];
  root.style.setProperty('--ui-btn-pad',       sz.pad);
  root.style.setProperty('--ui-btn-height',    sz.height);
  root.style.setProperty('--ui-btn-font',      sz.font);
  root.style.setProperty('--ui-btn-sm-pad',    sz.smPad);

  // Font scale
  const fs = FONT_SCALE[s.fontScale];
  root.style.setProperty('--ui-font-base', fs.base);
  root.style.setProperty('--ui-font-sm',   fs.sm);
  root.style.setProperty('--ui-font-xs',   fs.xs);
  root.style.setProperty('--ui-font-lg',   fs.lg);

  // Speed
  root.style.setProperty('--ui-speed', SPEED[s.animSpeed]);

  // Shadows
  root.style.setProperty('--ui-shadow',    SHADOW_LG[Math.max(0, s.shadowLevel - 1)] || 'none');
  root.style.setProperty('--ui-shadow-lg', SHADOW_LG[s.shadowLevel] || 'none');

  // Hover transform
  const hoverMap: Record<BtnHover, string> = {
    lift:   'translateY(-3px)',
    scale:  'scale(1.04)',
    slide:  'translateX(4px)',
    glow:   'none',
    ripple: 'none',
    none:   'none',
  };
  root.style.setProperty('--ui-btn-hover-transform', hoverMap[s.btnHover]);

  // Data-attrs on <html> drive CSS [data-*] selectors
  root.dataset.btnStyle   = s.btnStyle;
  root.dataset.btnHover   = s.btnHover;
  root.dataset.cardStyle  = s.cardStyle;
  root.dataset.navStyle   = s.navStyle;
  root.dataset.iconStyle  = s.iconStyle;
  root.dataset.iconAnim   = s.iconAnim;
}

// ── Persist / load ────────────────────────────────────────

const KEY = 'warehouse-wizard-ui-style';

export function loadUIStyle(): UIStyle {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultUIStyle, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaultUIStyle };
}

export function saveUIStyle(s: UIStyle): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

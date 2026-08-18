// Theme system with presets and custom theme support

export interface Theme {
  id: string;
  name: string;
  colors: {
    // Background layers
    bg: string;
    bg2: string;
    bg3: string;
    bg4: string;
    // Card surfaces
    surface: string;
    surface2: string;
    surface3: string;
    // Text
    ink: string;
    ink2: string;
    ink3: string;
    // Borders
    line: string;
    line2: string;
    // Primary brand
    primary: string;
    primaryD: string;
    primaryDim: string;
    primaryGlow: string;
    // Secondary accent
    amber: string;
    amberDim: string;
    amberGlow: string;
    // Status
    good: string;
    goodDim: string;
    goodGlow: string;
    warn: string;
    warnDim: string;
    bad: string;
    badDim: string;
    badGlow: string;
    purple: string;
    purpleDim: string;
  };
}

export const themes: Record<string, Theme> = {
  // ── DEFAULT: original approved Waterproofing+ light theme ──
  waterproofing: {
    id: 'waterproofing',
    name: 'Van Isle Water Proofing+',
    colors: {
      bg: '#f4f7fb',
      bg2: '#ffffff',
      bg3: '#e9eef5',
      bg4: '#dde4ef',
      surface: 'rgba(255,255,255,0.95)',
      surface2: 'rgba(244,247,251,0.90)',
      surface3: 'rgba(233,238,245,0.80)',
      ink: '#1C1E20',
      ink2: '#4f5b60',
      ink3: '#8a99ad',
      line: 'rgba(19,33,53,0.08)',
      line2: 'rgba(19,33,53,0.13)',
      primary: '#14A2A4',
      primaryD: '#1C1E20',
      primaryDim: 'rgba(20,162,164,0.10)',
      primaryGlow: 'rgba(20,162,164,0.25)',
      amber: '#c9820a',
      amberDim: 'rgba(201,130,10,0.12)',
      amberGlow: 'rgba(201,130,10,0.30)',
      good: '#1f9d63',
      goodDim: 'rgba(31,157,99,0.12)',
      goodGlow: 'rgba(31,157,99,0.28)',
      warn: '#c9820a',
      warnDim: 'rgba(201,130,10,0.12)',
      bad: '#d0453b',
      badDim: 'rgba(208,69,59,0.12)',
      badGlow: 'rgba(208,69,59,0.28)',
      purple: '#6b57d4',
      purpleDim: 'rgba(107,87,212,0.12)',
    },
  },

  midnight: {
    id: 'midnight',
    name: 'Midnight Teal',
    colors: {
      bg: '#060d1a',
      bg2: '#0b1526',
      bg3: '#111e35',
      bg4: '#172440',
      surface: 'rgba(16,26,46,0.80)',
      surface2: 'rgba(20,32,56,0.60)',
      surface3: 'rgba(26,40,68,0.50)',
      ink: '#e8f0ff',
      ink2: '#8899bb',
      ink3: '#4e6089',
      line: 'rgba(255,255,255,0.07)',
      line2: 'rgba(255,255,255,0.12)',
      primary: '#00d4ff',
      primaryD: '#0099cc',
      primaryDim: 'rgba(0,212,255,0.12)',
      primaryGlow: 'rgba(0,212,255,0.35)',
      amber: '#ffab00',
      amberDim: 'rgba(255,171,0,0.14)',
      amberGlow: 'rgba(255,171,0,0.40)',
      good: '#00e07a',
      goodDim: 'rgba(0,224,122,0.14)',
      goodGlow: 'rgba(0,224,122,0.35)',
      warn: '#ffab00',
      warnDim: 'rgba(255,171,0,0.14)',
      bad: '#ff4d6a',
      badDim: 'rgba(255,77,106,0.14)',
      badGlow: 'rgba(255,77,106,0.35)',
      purple: '#a78bfa',
      purpleDim: 'rgba(167,139,250,0.14)',
    },
  },

  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      bg: '#0a1628',
      bg2: '#0d1f3a',
      bg3: '#132847',
      bg4: '#1a3354',
      surface: 'rgba(18,32,58,0.80)',
      surface2: 'rgba(22,38,66,0.60)',
      surface3: 'rgba(28,46,78,0.50)',
      ink: '#e0f2ff',
      ink2: '#7ea8d9',
      ink3: '#4d7099',
      line: 'rgba(255,255,255,0.07)',
      line2: 'rgba(255,255,255,0.12)',
      primary: '#3b82f6',
      primaryD: '#1d4ed8',
      primaryDim: 'rgba(59,130,246,0.12)',
      primaryGlow: 'rgba(59,130,246,0.35)',
      amber: '#f59e0b',
      amberDim: 'rgba(245,158,11,0.14)',
      amberGlow: 'rgba(245,158,11,0.40)',
      good: '#10b981',
      goodDim: 'rgba(16,185,129,0.14)',
      goodGlow: 'rgba(16,185,129,0.35)',
      warn: '#f59e0b',
      warnDim: 'rgba(245,158,11,0.14)',
      bad: '#ef4444',
      badDim: 'rgba(239,68,68,0.14)',
      badGlow: 'rgba(239,68,68,0.35)',
      purple: '#8b5cf6',
      purpleDim: 'rgba(139,92,246,0.14)',
    },
  },

  sunset: {
    id: 'sunset',
    name: 'Sunset Orange',
    colors: {
      bg: '#1a0f0a',
      bg2: '#2a1810',
      bg3: '#3a2218',
      bg4: '#4a2e20',
      surface: 'rgba(48,28,20,0.80)',
      surface2: 'rgba(56,34,26,0.60)',
      surface3: 'rgba(64,42,32,0.50)',
      ink: '#fff5ed',
      ink2: '#d4a88a',
      ink3: '#9a7560',
      line: 'rgba(255,255,255,0.07)',
      line2: 'rgba(255,255,255,0.12)',
      primary: '#ff6b35',
      primaryD: '#cc4d1f',
      primaryDim: 'rgba(255,107,53,0.12)',
      primaryGlow: 'rgba(255,107,53,0.35)',
      amber: '#fbbf24',
      amberDim: 'rgba(251,191,36,0.14)',
      amberGlow: 'rgba(251,191,36,0.40)',
      good: '#34d399',
      goodDim: 'rgba(52,211,153,0.14)',
      goodGlow: 'rgba(52,211,153,0.35)',
      warn: '#fbbf24',
      warnDim: 'rgba(251,191,36,0.14)',
      bad: '#f87171',
      badDim: 'rgba(248,113,113,0.14)',
      badGlow: 'rgba(248,113,113,0.35)',
      purple: '#c084fc',
      purpleDim: 'rgba(192,132,252,0.14)',
    },
  },

  forest: {
    id: 'forest',
    name: 'Forest Green',
    colors: {
      bg: '#0a1410',
      bg2: '#0e1e1a',
      bg3: '#132824',
      bg4: '#18342e',
      surface: 'rgba(16,36,30,0.80)',
      surface2: 'rgba(20,44,36,0.60)',
      surface3: 'rgba(26,52,44,0.50)',
      ink: '#e0fff5',
      ink2: '#88ccb8',
      ink3: '#558877',
      line: 'rgba(255,255,255,0.07)',
      line2: 'rgba(255,255,255,0.12)',
      primary: '#10b981',
      primaryD: '#059669',
      primaryDim: 'rgba(16,185,129,0.12)',
      primaryGlow: 'rgba(16,185,129,0.35)',
      amber: '#fbbf24',
      amberDim: 'rgba(251,191,36,0.14)',
      amberGlow: 'rgba(251,191,36,0.40)',
      good: '#34d399',
      goodDim: 'rgba(52,211,153,0.14)',
      goodGlow: 'rgba(52,211,153,0.35)',
      warn: '#fbbf24',
      warnDim: 'rgba(251,191,36,0.14)',
      bad: '#f87171',
      badDim: 'rgba(248,113,113,0.14)',
      badGlow: 'rgba(248,113,113,0.35)',
      purple: '#a78bfa',
      purpleDim: 'rgba(167,139,250,0.14)',
    },
  },

  royal: {
    id: 'royal',
    name: 'Royal Purple',
    colors: {
      bg: '#0f0a1a',
      bg2: '#1a1028',
      bg3: '#251835',
      bg4: '#302244',
      surface: 'rgba(30,18,40,0.80)',
      surface2: 'rgba(38,24,52,0.60)',
      surface3: 'rgba(46,32,64,0.50)',
      ink: '#f5edff',
      ink2: '#b89dd4',
      ink3: '#7d669a',
      line: 'rgba(255,255,255,0.07)',
      line2: 'rgba(255,255,255,0.12)',
      primary: '#a78bfa',
      primaryD: '#7c3aed',
      primaryDim: 'rgba(167,139,250,0.12)',
      primaryGlow: 'rgba(167,139,250,0.35)',
      amber: '#fbbf24',
      amberDim: 'rgba(251,191,36,0.14)',
      amberGlow: 'rgba(251,191,36,0.40)',
      good: '#34d399',
      goodDim: 'rgba(52,211,153,0.14)',
      goodGlow: 'rgba(52,211,153,0.35)',
      warn: '#fbbf24',
      warnDim: 'rgba(251,191,36,0.14)',
      bad: '#f87171',
      badDim: 'rgba(248,113,113,0.14)',
      badGlow: 'rgba(248,113,113,0.35)',
      purple: '#c084fc',
      purpleDim: 'rgba(192,132,252,0.14)',
    },
  },

  slate: {
    id: 'slate',
    name: 'Slate Gray',
    colors: {
      bg: '#0f1419',
      bg2: '#1a1f28',
      bg3: '#252b36',
      bg4: '#303845',
      surface: 'rgba(26,31,40,0.80)',
      surface2: 'rgba(32,38,50,0.60)',
      surface3: 'rgba(40,48,62,0.50)',
      ink: '#f0f4f8',
      ink2: '#9aa5b5',
      ink3: '#64748b',
      line: 'rgba(255,255,255,0.07)',
      line2: 'rgba(255,255,255,0.12)',
      primary: '#38bdf8',
      primaryD: '#0284c7',
      primaryDim: 'rgba(56,189,248,0.12)',
      primaryGlow: 'rgba(56,189,248,0.35)',
      amber: '#fbbf24',
      amberDim: 'rgba(251,191,36,0.14)',
      amberGlow: 'rgba(251,191,36,0.40)',
      good: '#22c55e',
      goodDim: 'rgba(34,197,94,0.14)',
      goodGlow: 'rgba(34,197,94,0.35)',
      warn: '#fbbf24',
      warnDim: 'rgba(251,191,36,0.14)',
      bad: '#f87171',
      badDim: 'rgba(248,113,113,0.14)',
      badGlow: 'rgba(248,113,113,0.35)',
      purple: '#a78bfa',
      purpleDim: 'rgba(167,139,250,0.14)',
    },
  },
};

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const { colors } = theme;

  root.style.setProperty('--bg', colors.bg);
  root.style.setProperty('--bg-2', colors.bg2);
  root.style.setProperty('--bg-3', colors.bg3);
  root.style.setProperty('--bg-4', colors.bg4);

  root.style.setProperty('--surface', colors.surface);
  root.style.setProperty('--surface-2', colors.surface2);
  root.style.setProperty('--surface-3', colors.surface3);

  root.style.setProperty('--ink', colors.ink);
  root.style.setProperty('--ink-2', colors.ink2);
  root.style.setProperty('--ink-3', colors.ink3);

  root.style.setProperty('--line', colors.line);
  root.style.setProperty('--line-2', colors.line2);

  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-d', colors.primaryD);
  root.style.setProperty('--primary-dim', colors.primaryDim);
  root.style.setProperty('--primary-glow', colors.primaryGlow);

  root.style.setProperty('--amber', colors.amber);
  root.style.setProperty('--amber-dim', colors.amberDim);
  root.style.setProperty('--amber-glow', colors.amberGlow);

  root.style.setProperty('--good', colors.good);
  root.style.setProperty('--good-dim', colors.goodDim);
  root.style.setProperty('--good-glow', colors.goodGlow);
  root.style.setProperty('--good-bg', colors.goodDim);

  root.style.setProperty('--warn', colors.warn);
  root.style.setProperty('--warn-dim', colors.warnDim);
  root.style.setProperty('--warn-bg', colors.warnDim);

  root.style.setProperty('--bad', colors.bad);
  root.style.setProperty('--bad-dim', colors.badDim);
  root.style.setProperty('--bad-glow', colors.badGlow);
  root.style.setProperty('--bad-bg', colors.badDim);

  root.style.setProperty('--purple', colors.purple);
  root.style.setProperty('--purple-dim', colors.purpleDim);
  root.style.setProperty('--purple-bg', colors.purpleDim);

  // Mark light vs dark so CSS can adjust body/header accordingly
  const mode = isLightTheme(theme) ? 'light' : 'dark';
  root.dataset.themeMode = mode;
  root.dataset.theme = mode;
}

/** Heuristic: if bg is a light colour, treat as light theme */
function isLightTheme(theme: Theme): boolean {
  const bg = theme.colors.bg;
  // Skip rgba strings
  if (!bg.startsWith('#')) return false;
  const clean = bg.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  // Perceived luminance > 128 → light
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function loadTheme(): Theme {
  const stored = localStorage.getItem('warehouse-wizard-theme');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.id === 'custom' ? parsed : (themes[parsed.id] || themes.waterproofing);
    } catch {
      return themes.waterproofing;
    }
  }
  return themes.waterproofing;
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem('warehouse-wizard-theme', JSON.stringify(theme));
}

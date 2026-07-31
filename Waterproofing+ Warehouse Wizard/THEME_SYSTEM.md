# Theme System Documentation

## Overview

The Waterproofing+ Warehouse Wizard now includes a complete theming system with **6 preset themes** and a **custom theme editor** that allows users to personalize every color in the interface.

## Features

### 🎨 6 Preset Themes

1. **Midnight Teal** (Default)
   - Deep navy background with electric teal accents
   - Professional, modern feel
   - Perfect for low-light environments

2. **Ocean Blue**
   - Classic blue tones
   - Traditional business look
   - Easy on the eyes for extended use

3. **Sunset Orange**
   - Warm orange and amber hues
   - Energetic, creative vibe
   - Great for daytime work

4. **Forest Green**
   - Natural green palette
   - Calming, balanced aesthetic
   - Reduces eye strain

5. **Royal Purple**
   - Rich purple gradients
   - Luxurious, premium feel
   - Stands out from typical dashboards

6. **Slate Gray**
   - Neutral gray tones
   - Minimalist, focused interface
   - Professional and versatile

### 🛠️ Custom Theme Editor

Users can create their own themes by customizing:

**Primary Colors:**
- Primary accent color
- Primary dark variant
- Secondary amber accent

**Status Colors:**
- Success (good) color
- Warning color
- Danger/error color
- Purple accent

**Background Layers:**
- Base background
- Layer 2 (cards, surfaces)
- Layer 3 (elevated elements)

**Text Colors:**
- Primary text
- Secondary text
- Muted text

All changes are **applied instantly** and **persisted to localStorage**, so the custom theme survives page refreshes.

## Usage

### Accessing the Theme Editor

1. Navigate to the **Admin** tab (requires Manager or Admin role)
2. Look for the **"Theme Customization"** card at the top
3. Click **"Customize Theme"**

### Switching Themes

In the theme editor:
- Click any preset theme card to instantly switch
- The active theme is highlighted

### Creating a Custom Theme

1. Click **"Customize Colors"** to open the color editor
2. Adjust any color using:
   - **Color picker** (visual selector)
   - **Text input** (hex codes or rgba values)
3. Changes apply in real-time as you edit
4. Click **"Save Custom Theme"** when satisfied
5. Click **"Reset to Midnight"** to return to defaults

## Technical Details

### Files

- **`src/themes.ts`** - Theme definitions, presets, and utilities
- **`src/components/ThemeEditor.tsx`** - Theme switcher and editor UI
- **`src/styles.css`** - CSS custom properties driven by themes
- **`THEME_SYSTEM.md`** - This documentation

### Storage

Themes are stored in **localStorage** under the key:
```
warehouse-wizard-theme
```

The stored value is a JSON object containing either:
- A preset theme ID (e.g., `{ "id": "ocean" }`)
- A full custom theme object with all color values

### Adding New Preset Themes

Edit `src/themes.ts` and add a new entry to the `themes` object:

```typescript
myTheme: {
  id: 'myTheme',
  name: 'My Custom Theme',
  colors: {
    bg: '#...',
    bg2: '#...',
    // ... all other color properties
  },
}
```

## Color Guidelines

When creating custom themes:

- **Backgrounds** should be dark for low-light environments
- **Primary colors** should have good contrast against backgrounds
- **Status colors** (good/warn/bad) should be immediately distinguishable
- **Text colors** should meet WCAG AA contrast ratios (4.5:1 minimum)
- Use **rgba()** for semi-transparent surfaces to enable glassmorphism effects

## Browser Support

The theme system uses:
- CSS Custom Properties (IE 11+, all modern browsers)
- LocalStorage (universal support)
- Color input type (all modern browsers, graceful degradation)

## Future Enhancements

Potential additions:
- Export/import theme as JSON file
- Share theme via URL parameter
- Light mode variants
- Per-user theme sync via Supabase
- Community theme gallery

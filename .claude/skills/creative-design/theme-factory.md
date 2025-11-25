---
name: theme-factory
description: Generate consistent design systems and themes for Telegram Mini App with Tailwind CSS, including color palettes, typography, spacing, and component variants.
---

# Theme Factory Skill

This skill creates cohesive design systems for the AI Media Generator Telegram Mini App.

## Capabilities

### Color Palette Generation
- Primary colors (brand identity)
- Secondary colors (accents, CTAs)
- Semantic colors (success, error, warning, info)
- Neutral colors (text, backgrounds, borders)
- Telegram-native color integration
- Dark mode variants (if needed)

### Typography System
- Font family hierarchy
- Font size scale (xs, sm, base, lg, xl, 2xl, etc.)
- Line height ratios
- Font weight scale
- Letter spacing
- Responsive typography

### Spacing System
- Base spacing unit (4px or 8px)
- Spacing scale (1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64)
- Container widths
- Component padding/margin presets

### Component Variants
- Button variants (primary, secondary, outline, ghost, danger)
- Card variants (default, elevated, bordered)
- Input variants (default, error, success)
- Badge variants (status indicators)
- Alert/Toast variants

## Tailwind Configuration

**Location**: `frontend/tailwind.config.js`

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // ... more colors
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      }
    }
  }
}
```

## Design Tokens

### Colors (Current System)
```
Primary: Blue (#3B82F6) - CTAs, links
Secondary: Purple (#8B5CF6) - Accents
Success: Green (#10B981) - Success states
Error: Red (#EF4444) - Errors, destructive actions
Warning: Amber (#F59E0B) - Warnings
Info: Cyan (#06B6D4) - Information
```

### Typography
```
Headings: font-bold (700)
Body: font-normal (400)
Labels: font-medium (500)

Sizes:
- xs: 0.75rem (12px)
- sm: 0.875rem (14px)
- base: 1rem (16px)
- lg: 1.125rem (18px)
- xl: 1.25rem (20px)
- 2xl: 1.5rem (24px)
```

### Spacing
```
Base unit: 4px (0.25rem)

Common values:
- 1: 0.25rem (4px)
- 2: 0.5rem (8px)
- 4: 1rem (16px)
- 6: 1.5rem (24px)
- 8: 2rem (32px)
```

## Component Theme Examples

### Button
```tsx
// Primary
className="bg-primary-500 hover:bg-primary-600 text-white font-medium py-3 px-6 rounded-lg"

// Secondary
className="bg-secondary-500 hover:bg-secondary-600 text-white font-medium py-3 px-6 rounded-lg"

// Outline
className="border-2 border-primary-500 text-primary-500 hover:bg-primary-50 font-medium py-3 px-6 rounded-lg"
```

### Card
```tsx
// Default
className="bg-white rounded-xl shadow-md p-6"

// Elevated
className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
```

### Input
```tsx
// Default
className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"

// Error
className="w-full px-4 py-3 border-2 border-error-500 rounded-lg focus:ring-2 focus:ring-error-500"
```

## Telegram Native Styling

Telegram Mini Apps have native color variables:
- `var(--tg-theme-bg-color)` - Background color
- `var(--tg-theme-text-color)` - Text color
- `var(--tg-theme-button-color)` - Button color
- `var(--tg-theme-button-text-color)` - Button text

**Usage**:
```css
.telegram-native-button {
  background-color: var(--tg-theme-button-color);
  color: var(--tg-theme-button-text-color);
}
```

## Design System Output

When creating a theme:
1. Color palette with contrast ratios (WCAG AA compliance)
2. Typography scale with line heights
3. Spacing system documentation
4. Component variant classes (Tailwind)
5. Dark mode variants (if needed)
6. Figma/Sketch export (if available)

## Quality Standards

- ✅ WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI)
- ✅ Consistent spacing (4px base unit)
- ✅ Mobile-first responsive design
- ✅ Telegram UI guidelines compliance
- ✅ Performance (minimal CSS bundle)

Reference `frontend/src/components/ui/` for existing component styles.

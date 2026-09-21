---
name: gaas-design-system
description: >-
  Complete UI/UX design specifications, CSS design tokens, components, and hover/focus styling
  conventions for the PGN Solution GAAS application. Use when creating, modifying, or refactoring
  front-end pages, modal forms, navigation tabs, cards, and input fields to maintain visual consistency.
---

# GAAS Design System & Component Guidelines

This skill documents the official design standards, color tokens, and interactive styling patterns for GAAS.

## 1. Official Color Palette & CSS Variables

| Token | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `--blue-600` | `#1450c9` | `#1450c9` | Primary gradient dark stop, brand deep blue |
| `--blue-500` | `#1c6dff` | `#1c6dff` | Interactive active text, primary accent, tab highlights |
| `--blue-400` | `#4b8dff` | `#4b8dff` | **Signature Hover & Focus Border**, gradient light stop |
| `--blue-300` | `#7fb0ff` | `#7fb0ff` | Soft highlight, subtle borders |
| `--ice-100` | `#eef4ff` | - | Light app background (`--bg-app`) |
| `--bg-surface` | `#ffffff` | `#081328` | Card and modal surface background |
| `--bg-surface-alt` | `#f5f9ff` | `#0c1c3d` | Input background, table striped rows, toolbar well |
| `--border-subtle` | `#dbe6fb` | `#16234a` | Default border for resting cards and inputs |
| `--border-strong` | `#b7d3ff` | `#21356e` | Prominent boundary lines |

## 2. Signature Hover & Interactive Standard

Whenever an interactive element, card, or input field is hovered, it must adhere to the **GAAS signature blue glow pattern**:

```css
/* Card & Button Hover */
.element:hover {
  transform: translateY(-2px);
  border-color: var(--blue-400);
  box-shadow: var(--glow-blue);
}

/* Input, Select, Textarea Hover */
.field input:hover:not(:disabled),
.field select:hover:not(:disabled),
.field textarea:hover:not(:disabled),
.searchable-select-trigger:hover,
.filter-picker-trigger:hover {
  border-color: var(--blue-400);
}

/* Focus State */
.field input:focus,
.field select:focus,
.field textarea:focus,
.searchable-select-trigger:focus {
  outline: none;
  border-color: var(--blue-400);
  box-shadow: 0 0 0 3px rgba(75, 141, 255, 0.2);
}
```

## 3. Standard Component Architecture

### A. Form Controls
Always wrap form inputs in `.field` (with `margin-bottom: 18px` and `.field label` styled with `font-weight: 600`, `color: var(--text-secondary)`).
Use `.form-grid` (2 columns) with `.field.full` for multi-column spans.

### B. Custom Dropdown Selects
- `SearchableSelect`: Replace plain HTML selects with SearchableSelect for division, department, or carrier selections.
- `DateFilterPicker` & `MonthFilterPicker`: Replace native date pickers with custom styled dropdown calendar pickers.

### C. Navigation Tabs
- Container: `.superadmin-tabs-nav` with background `var(--bg-surface-alt)` and `border-radius: 14px`.
- Inactive Button: `.superadmin-tab-btn` (turns `border-color: var(--blue-400)` and text `var(--blue-500)` on hover).
- Active Button: `.superadmin-tab-btn-active` with `background: var(--gradient-primary)` and white text.

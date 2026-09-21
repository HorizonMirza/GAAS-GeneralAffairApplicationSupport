---
name: gaas-design-system
description: >-
  Exhaustive UI/UX design specifications, CSS design tokens, components, interactive states,
  and layout patterns for the PGN Solution GAAS application. Use whenever creating, modifying,
  or refactoring front-end pages, modal forms, navigation tabs, cards, tables, and form controls
  to ensure 100% visual and behavioral consistency with the existing application.
---

# GAAS Design System & Component Master Reference

This document serves as the single source of truth for all visual, structural, and interactive design patterns across the PGN Solution General Affair Application Support (GAAS) frontend.

---

## 1. Design Tokens & CSS Variables

All CSS variables are defined in `globals.css` under `:root` (light) and `:root[data-theme="dark"]`.

### A. Primary Blues & Gradients
| Token | Hex / Value | Usage |
|---|---|---|
| `--navy-950` | `#050b1a` | Darkest background, login page background |
| `--navy-900` | `#081328` | Dark mode surface background (`--bg-surface`) |
| `--navy-800` | `#0c1c3d` | Dark mode secondary surface (`--bg-surface-alt`) |
| `--navy-700` | `#10275a` | Deep blue borders and containers in dark mode |
| `--blue-600` | `#1450c9` | Dark stop of primary gradient |
| `--blue-500` | `#1c6dff` | Active links, primary icons, active tab highlights |
| `--blue-400` | `#4b8dff` | **Signature Hover & Focus Border**, light stop of primary gradient |
| `--blue-300` | `#7fb0ff` | Subtle hover borders, soft highlights |
| `--blue-200` | `#b7d3ff` | Dark mode text gradient accent |
| `--ice-100` | `#eef4ff` | Light mode application background (`--bg-app`) |
| `--gradient-primary` | `linear-gradient(135deg, var(--blue-600) 0%, var(--blue-400) 100%)` | Primary button fill, active tab background, avatar headers |
| `--gradient-primary-hover` | `linear-gradient(135deg, var(--blue-500) 0%, var(--blue-300) 100%)` | Primary button hover fill |
| `--gradient-navy` | `linear-gradient(135deg, var(--navy-900) 0%, var(--blue-600) 55%, var(--blue-400) 100%)` | Sidebar banner background |

### B. Surfaces, Borders & Shadows
| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--bg-app` | `var(--ice-100)` | `var(--navy-950)` | Full page canvas background |
| `--bg-surface` | `#ffffff` | `var(--navy-900)` | Cards, modals, dropdown panels |
| `--bg-surface-alt` | `#f5f9ff` | `var(--navy-800)` | Input fields, table alt rows, filter wells |
| `--border-subtle` | `#dbe6fb` | `#16234a` | Default resting borders on cards, inputs, tabs |
| `--border-strong` | `#b7d3ff` | `#21356e` | Highlighted borders, timeline dividers |
| `--shadow-card` | `0 6px 20px rgba(15, 40, 90, 0.08)` | `0 10px 30px rgba(0, 0, 0, 0.45)` | Standard card elevation |
| `--glow-blue` | `0 0 0 1px rgba(75, 141, 255, 0.25), 0 8px 28px rgba(20, 80, 201, 0.35)` | - | Card hover elevation & focused halo |

### C. Status & Badge Colors
| Status Meaning | Background Variable | Hex | Text Variable |
|---|---|---|---|
| Submitted / Waiting Approval | `--badge-submitted-bg` / `--badge-waiting-bg` | `#f59e0b` (Amber) | `#ffffff` |
| Completed / Approved | `--badge-completed-bg` | `#16a34a` (Green) | `#ffffff` |
| Rejected / Canceled | `--badge-rejected-bg` | `#dc2626` (Red) | `#ffffff` |
| Draft | `--badge-draft-bg` | `#64748b` (Slate) | `#ffffff` |

---

## 2. Typography & Font System

* **Font Stack**: `-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
* **Root Smoothness**: `-webkit-font-smoothing: antialiased;`
* **Hierarchy**:
  - Page Titles (`h1`, `.superadmin-header h1`): `1.35rem`, `font-weight: 700`, `color: var(--text-primary)`.
  - Section Headers (`h3`, `.card-header h3`): `1.02rem` - `1.15rem`, `font-weight: 700`.
  - Subsection / Card Titles (`h4`): `0.95rem`, `font-weight: 700`.
  - Form Labels (`.field label`): `0.85rem`, `font-weight: 600`, `color: var(--text-secondary)`.
  - Body & Table Text: `0.88rem` - `0.95rem`, `line-height: 1.4`.
  - Captions & Meta (`.text-secondary`): `0.78rem` - `0.82rem`.

---

## 3. Signature Interactive States (Mandatory Rule)

Whenever an interactive element is hovered or focused in GAAS, it **MUST** follow these exact rules:

```css
/* 1. Cards, Module Buttons & Interactive Containers */
.card-interactive:hover,
.module-card:hover,
.dashboard-module-btn:hover,
.dashboard-stat-card:hover,
.room-card:hover {
  transform: translateY(-2px);
  border-color: var(--blue-400);
  box-shadow: var(--glow-blue);
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

/* 2. Inputs, Selects, and Textareas */
.field input,
.field select,
.field textarea {
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field input:hover:not(:disabled),
.field select:hover:not(:disabled),
.field textarea:hover:not(:disabled),
.searchable-select-trigger:hover,
.filter-picker-trigger:hover,
.date-picker-select-trigger:hover,
.room-multiselect-trigger:hover {
  border-color: var(--blue-400);
}

.field input:focus,
.field select:focus,
.field textarea:focus,
.searchable-select-trigger:focus,
.filter-picker-trigger:focus {
  outline: none;
  border-color: var(--blue-400);
  box-shadow: 0 0 0 3px rgba(75, 141, 255, 0.2);
}
```

---

## 4. Button Hierarchy

| Class | Appearance | Hover Effect | Usage |
|---|---|---|---|
| `.btn-primary` | Solid gradient (`var(--gradient-primary)`), white text | `background: var(--gradient-primary-hover)`, `transform: translateY(-1px)` | Primary submit, create, confirm actions |
| `.btn-secondary` | White surface, `1px solid var(--border-subtle)`, text secondary | `border-color: var(--blue-400)`, `color: var(--blue-500)` | Cancel, close, secondary options |
| `.btn-approve` | Solid green (`var(--green-500)`), white text | `background: var(--green-600)` | Approval actions in detail modals |
| `.btn-danger` | Outline red (`1px solid var(--badge-rejected-bg)`) | Red background, white text | Reject, delete triggers |
| `.btn-confirm-danger`| Solid red (`var(--badge-rejected-bg)`), white text | Darker red (`#b91c1c`) | Final confirmation of deletion |
| `.icon-btn` | Transparent, circular/rounded icon button | `background: var(--bg-surface-alt)`, `border-color: var(--blue-400)` | Table action icons, toolbars |

---

## 5. Form Architecture & Input Controls

```text
.form-grid (2-column CSS grid, gap: 16px)
 ├── .field (column 1)
 ├── .field (column 2)
 └── .field.full (spans both columns via grid-column: 1 / -1)
```

1. **Standard `.field`**:
   - `margin-bottom: 18px; min-width: 0;`
   - Label: `display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;`
   - Disabled inputs: `background: var(--bg-surface); cursor: not-allowed;` with lock icon `.field-lock-icon`.
2. **`SearchableSelect`**:
   - Custom searchable dropdown component for division/department selection.
   - Built-in auto-flip (`.searchable-select-panel-up`) when near the bottom of viewport.
3. **`DateFilterPicker` & `MonthFilterPicker`**:
   - In-app custom calendar widgets styled consistently with GAAS inputs.
   - Never use native unstyled `<input type="date">` in final UI.

---

## 6. Card & List System

1. **`.card`**:
   - `background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 22px; box-shadow: var(--shadow-card);`
2. **`.item-row-card` with Animated Conic Border Beam**:
   - Used in Overview list views (Ekspedisi, ATK, Arsip).
   - `.item-row-card-onapproval::before`: Conic animated amber beam (`animation: card-border-beam 3s linear infinite`).
   - `.item-row-card-approved::before`: Conic animated green beam.
   - `.item-row-card-rejected::before`: Conic animated red beam.
3. **`.dashboard-stat-card`**:
   - 2-column grid (`.dashboard-stats-grid`).
   - Highlights 3 KPI boxes (`.dashboard-stat-highlight-box` with `.primary`, `.warning`, `.success`, `.danger`).

---

## 7. Navigation Tabs System

1. **Top-Level Tabs (`.superadmin-tabs-nav`)**:
   - Container: Flex row with `gap: 6px`, `padding: 6px`, `background: var(--bg-surface-alt)`, `border-radius: 14px`, `overflow-x: auto`.
   - Button (`.superadmin-tab-btn`): `padding: 8px 16px; border-radius: 10px; border: 1px solid transparent; font-size: 0.84rem; font-weight: 600;`
   - Hover: `border-color: var(--blue-400); color: var(--blue-500); background: var(--bg-surface);`
   - Active (`.superadmin-tab-btn-active`): `background: var(--gradient-primary); color: #fff;`
2. **Subtabs (`.superadmin-subtabs`)**:
   - Button (`.superadmin-subtab-btn`): `padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border-subtle); font-size: 0.82rem;`
   - Active: `background: var(--blue-500); color: #fff; border-color: var(--blue-500);`

---

## 8. Data Tables & Toolbars

1. **`.toolbar`**:
   - Flex container with search input, dropdown filter triggers, date picker, and `.toolbar-actions` on the right.
   - Control height pinned to `38px` (`box-sizing: border-box`).
2. **`.data-table`**:
   - `width: 100%; border-collapse: separate; border-spacing: 0;`
   - Header `th`: `background: var(--bg-surface-alt); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-secondary);`
   - Row hover: `.data-table tbody tr:hover { background: var(--bg-surface-alt); }`
   - Pagination: Clean bottom bar with item counts, page size dropdown, and page navigation buttons.

---

## 9. Responsive Breakpoints

* **Desktop Wide**: $> 1200px$ (Full 2-column layouts, expanded sidebars).
* **Desktop Medium / Tablet Landscape**: $960px - 1200px$ (`.dashboard-stats-grid` collapses to 1 column at $\le 960px$).
* **Tablet Portrait**: $768px$ (Sidebar collapses, tables enable horizontal scroll).
* **Mobile**: $\le 480px$ (Module grids collapse to 1 column, modal paddings tighten to 16px).

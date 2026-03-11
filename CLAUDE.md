# CLAUDE.md - Smart Lead Manager CRM

## Project Overview

A Hebrew RTL lead management CRM built with React 19 + TypeScript + Vite. Fully client-side with localStorage persistence, CSV/Google Sheets import, Wix integration, and Google Gemini AI-powered data extraction.

## Tech Stack

- **Framework:** React 19.2 with TypeScript 5.8
- **Bundler:** Vite 6.2
- **Styling:** Tailwind CSS 3 (loaded via CDN in `index.html`)
- **AI:** Google Gemini (`@google/genai`) - model: `gemini-3-flash-preview`
- **Storage:** localStorage (keys: `crm_leads`, `crm_logs`)
- **No backend** - entirely client-side

## Commands

```bash
npm run dev       # Start dev server on localhost:3000
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

There are **no tests, linters, or formatters** configured in this project.

## Project Structure

```
/
├── App.tsx                  # Root component, all app state lives here
├── index.tsx                # React entry point
├── types.ts                 # All TypeScript interfaces & enums
├── constants.ts             # Default statuses, columns, mock data
├── vite.config.ts           # Vite config (port 3000, GEMINI_API_KEY injection)
├── index.html               # HTML shell with Tailwind CDN & Google Fonts
└── components/
    ├── LeadTable.tsx         # Main lead table with sorting & inline status editing
    ├── LeadDetailModal.tsx   # Lead detail view with notes & reminders
    ├── ImportModal.tsx       # CSV file & Google Sheets import
    ├── AIExtractModal.tsx    # Gemini AI text-to-lead extraction
    ├── AddLeadModal.tsx      # Manual lead creation form
    ├── Dashboard.tsx         # KPI cards & status distribution chart
    ├── TasksView.tsx         # Task & reminder management
    ├── SettingsModal.tsx     # Status & column configuration (back office)
    ├── Sidebar.tsx           # Navigation sidebar
    ├── Header.tsx            # Search bar & notifications bell
    └── SystemLogModal.tsx    # System log viewer
```

## Architecture

### State Management

All state is lifted to `App.tsx` using React hooks (`useState`, `useCallback`, `useMemo`, `useEffect`). No Redux, Context API, or external state libraries. State is passed to children via props.

Key state: `leads`, `tasks`, `statuses`, `columns`, `logs`, plus UI flags for modals and search.

### Navigation

Single-page tab navigation via `activeTab` state (`'dashboard' | 'leads' | 'tasks'`). No router library. Modals are conditionally rendered based on boolean flags.

### Component Hierarchy

```
App (state + mock auth)
├── Sidebar → tab switching
├── Header → search + notifications
├── Dashboard | LeadTable | TasksView  (based on activeTab)
└── Modals: LeadDetailModal, SettingsModal, AddLeadModal, ImportModal, SystemLogModal, AIExtractModal
```

## Key Types (types.ts)

- `Lead` - core entity with `id`, `name`, `phone`, `email?`, `statusId`, `notes[]`, `dynamicData` (custom fields)
- `StatusConfig` - customizable status with `label`, `color`, `rowColor`, `order`
- `Column` - dynamic column definition (`type: 'text' | 'number' | 'date'`)
- `Task` - linked to leads via optional `leadId`
- `StatusKey` - enum: `DONE`, `NO_ANSWER`, `CALLBACK`, `CANCELLED`, `NEW`

## Code Conventions

### Naming

- **Files:** PascalCase for components (`LeadTable.tsx`), camelCase for utilities (`types.ts`, `constants.ts`)
- **Props interfaces:** `[ComponentName]Props`
- **Handlers:** `handle[Action]` (e.g., `handleAddNote`, `handleWixSync`)
- **State setters:** `set[State]`
- **Icon components:** `[Name]Icon`

### Style

- Arrow functions preferred
- Semicolons used
- Two-space indentation
- All functional components (no class components)
- Inline SVG icons (no icon library)

### Commit Messages

Use conventional commit format: `feat: Description in imperative mood`

## Environment Variables

- `GEMINI_API_KEY` - Required for AI extraction feature. Injected via `vite.config.ts` as `process.env.GEMINI_API_KEY`.

## RTL / Hebrew

The entire UI is in Hebrew with `dir="rtl"`. All user-facing strings, labels, error messages, and timestamps use Hebrew locale. The font is "Assistant" from Google Fonts. Keep all new UI text in Hebrew to maintain consistency.

## Path Aliases

`@/*` maps to the project root (`./`), configured in both `tsconfig.json` and `vite.config.ts`.

## External API Integrations

1. **Wix Pricing Plans API** - Fetches canceled orders. Uses hardcoded site ID and auth token in `App.tsx`. CORS-blocked in browser (needs server proxy).
2. **Google Gemini AI** - Extracts lead data from unstructured text via `@google/genai`. Schema is dynamically generated from configured columns.
3. **Google Sheets** - Imports CSV data via public export URL.

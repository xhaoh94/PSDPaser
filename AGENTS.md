# Developer Guidelines for PSDPaser

This document provides instructions for agentic coding assistants operating in the PSDPaser repository.

## Project Overview
PSDPaser is a web-based tool for parsing Photoshop (PSD) files and exporting them to FairyGUI (FGUI) format. It uses React 19, Vite, Zustand, Ant Design, and TailWind CSS.

## Build and Development Commands

- **Development Server**: `npm run dev`
- **Build Project**: `npm run build` (Runs type checking and Vite build)
- **Linting**: `npm run lint` (Uses ESLint with TypeScript rules)
- **Preview Build**: `npm run preview`
- **Testing**: Currently, no automated test suite (Jest/Vitest) is configured in this repository.

## Code Style Guidelines

### 1. General Principles
- **TypeScript**: Use strict typing. Avoid `any` at all costs. Prefer interfaces over types for public APIs.
- **Components**: Use Functional Components with React Hooks.
- **State Management**: Use Zustand for global state (`src/stores/`). Use local `useState` for UI-only state.
- **Styling**: Use Tailwind CSS for utility-first styling. Prefer inline Tailwind classes over CSS modules unless complexity justifies it.

### 2. Naming Conventions
- **Files**:
  - Components: `PascalCase.tsx`
  - Hooks: `useCamelCase.ts`
  - Stores: `camelCaseStore.ts`
  - Utils: `camelCase.ts`
- **Variables & Functions**: `camelCase`
- **Interfaces & Types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

### 3. Import Order
1. React and standard hooks (e.g., `useEffect`, `useState`).
2. Third-party UI libraries (e.g., `antd`, `@ant-design/icons`).
3. Internal stores (`./stores`).
4. Internal components (`./components`).
5. Internal utilities, types, and hooks.
6. Styles and assets.

### 4. Error Handling
- Use `try/catch` blocks for all async operations (file system access, PSD parsing).
- Provide user feedback using Ant Design's `message.error()` or `Modal.error()`.
- Log detailed errors to the console for debugging.

### 5. Asynchronous Patterns
- Prefer `async/await` over raw Promises.
- Use Web Workers for heavy computations (e.g., `parsePsdFromFileAsync`).
- Use `useCallback` for functions passed as props to child components.

### 6. Persistence
- Use the File System Access API for directory handles.
- Persist configuration and history (like directory handles and export settings) in IndexedDB using the provided store wrappers in `src/stores/fileSystemStore.ts`.

## FGUI Export Specifics
- **Rule Engine**: Naming rules are defined in `src/utils/fgui/nameParser.ts` and can be customized via `fgui.json`.
- **Rendering**: Custom layer rendering (baking effects like gradients/strokes) is handled in `src/utils/fgui/renderer.ts`.
- **XML Generation**: XML structures for FGUI packages and components are managed in `src/utils/fgui/xmlGenerator.ts`.
- **Output Structure**:
  - Assets: `/Assets/`
  - Components: `/Component/`
  - Views: `/View/` (Main UI layouts)

## Automated Checks
Always run `npm run lint` and `npm run build` before finalizing changes to ensure type safety and code quality.

# All-in-One Application

Electron + React + TypeScript starter that ships with hot reload in development and packaging via `electron-builder`. Everything is wired for a secure IPC channel, Redux Toolkit global state, and realistic build/test tooling.

## Stack & Versions
| Layer        | Technology / Version                                              |
|--------------|-------------------------------------------------------------------|
| Renderer UI  | React 18 + Redux Toolkit + plain CSS                              |
| Main process | Electron 39 (TypeScript)                                          |
| Bundler      | Webpack 5 + Babel (`@babel/preset-react`, `@babel/preset-typescript`) |
| Tests        | Jest 30 (`ts-jest`, Testing Library) & Playwright 1.56            |
| Packaging    | `electron-builder` 25                                             |

## Getting Started
1. Install deps: `npm install`
2. Development mode: `npm run dev` – recompiles `src/**` via webpack + nodemon and launches Electron
3. Type checking: `npm run typecheck`
4. Unit tests: `npm test`
5. Production build: `npm run build` – emits `dist/main/**` (tsc) + `dist/bundle.js` (webpack)
6. Package installers: `npm run dist`

> For detailed build/device workflow docs (webpack outputs, tsconfig matrix, scripts, project structure, device flow), see [`docs/build-device-workflow.md`](docs/build-device-workflow.md).

## Packaging Notes
- Always run `npm run build` before `npm run dist` so both `dist/main/**` and `dist/bundle.js` exist.
- `electron-builder` config (app ID, product name, targets) lives in `package.json`.


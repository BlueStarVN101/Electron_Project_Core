# All-in-One Application

An Electron + React + TypeScript starter that ships with secure preload bridges, hot-reload friendly tooling, and packaging via `electron-builder`.

## Features
- Typed React renderer bundled by Webpack
- Hardened Electron main process with preload context isolation
- Simple `nodemon`-driven dev loop that rebuilds main + renderer then relaunches Electron with DevTools
- Production build + installer generation powered by `electron-builder`

## Getting Started
1. Install dependencies
   ```bash
   npm install
   ```

2. Start development mode (nodemon watches `src/**`, rebuilds, then relaunches Electron with DevTools)
   ```bash
   npm run dev
   ```

3. Type-check without emitting files
   ```bash
   npm run typecheck
   ```

4. Run unit tests (Jest + ts-jest)
   ```bash
   npm test
   ```

5. Produce production assets (`dist/`) and TypeScript output (`dist/main.js`, `dist/preload.js`)
   ```bash
   npm run build
   ```

6. Build distributables / installers
   ```bash
   npm run dist
   ```

## Available Scripts
- `npm run dev:build` – Rebuilds the main process (`tsc`) and renderer bundle (`webpack`) without launching Electron.
- `npm run build:main` – Compiles everything under `src/main/**` (including preload) into `dist/main/**`.
- `npm run build:renderer` – Bundles the React renderer (`src/renderer/app/renderer.tsx`) with Webpack in development mode.
- `npm run typecheck` – Runs the TypeScript compiler in `--noEmit` mode for faster feedback.
- `npm test` – Executes Jest with `ts-jest`, producing coverage in `coverage/`.
- `npm run build` – Runs the production renderer build plus `tsc -p tsconfig.prod.json`.
- `npm run dist` – Packages the app via `electron-builder` (requires `npm run build` first).

## Project Structure
- `src/main/index.ts` – Electron entry point wiring `app` events to the bootstrap layer
- `src/main/app/main.ts` – Creates BrowserWindows, installs DevTools, coordinates lifecycle
- `src/main/preload/**` – ContextIsolation bridges (one file per exposed API)
- `src/renderer/app/App.tsx` – React root component
- `src/renderer/app/renderer.tsx` – React entry rendered by Webpack
- `src/shared/models/**` – Types shared between main, preload, and renderer
- `webpack.config.js` – Renderer bundler configuration
- `tsconfig*.json` – Shared / production TypeScript configs
- `index.html` – Renderer HTML shell loaded by the main process

## Packaging Notes
- Run `npm run build` before `npm run dist` so both `dist/main/**` and `dist/bundle.js` exist.
- `electron-builder` configuration (app id, product name, targets) lives in `package.json`.
- Ensure `index.html`, `dist/main/index.js`, `dist/main/preload/index.js`, and `dist/bundle.js` are present in the app bundle.
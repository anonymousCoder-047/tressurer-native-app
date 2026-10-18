# Tressurer — Mobile App

Expense and treasury tracking app built with Expo and React Native. Track transactions across workspaces, audit activity, and export reports (XLSX/PDF).

## Tech Stack

- **Expo SDK 57** / React Native 0.86 / React 19
- **Expo Router** — file-based navigation (`app/`)
- **Zustand** — state management (`store/`)
- **Axios** — API client (`services/api.js`)
- **expo-secure-store** — JWT/token storage
- **xlsx, expo-print, expo-sharing** — report export

## Features

- Email + OAuth sign-in (Google, Microsoft — backend-mediated)
- Multi-workspace transaction logging (cash in/out, audit trail)
- Reports with date ranges and export to XLSX/PDF
- Trash / restore, audit log viewer, per-workspace settings

## Prerequisites

- Node.js 18+
- Android Studio (Android) or Xcode (iOS) for native builds
- The Tressurer backend running locally or reachable over the network

## Getting Started

```bash
npm install

# optional — only needed for staging/prod or a non-default backend host
cp .env.example .env

npx expo start        # dev server (Expo Go / dev build)
npx expo run:android  # native build — Android
npx expo run:ios      # native build — iOS
npx expo start --web  # web
```

In development, the app derives the backend host from the Metro bundler address and calls `http://<host>:5000`, so a physical device reaches a backend running on the same machine automatically. Override with `EXPO_PUBLIC_API_URL` in `.env` (see `.env.example`).

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Build & run on Android |
| `npm run ios` | Build & run on iOS |
| `npm run web` | Run on web |
| `npm run lint` | Lint (eslint-config-expo) |
| `npx tsc --noEmit` | Typecheck |

## Project Structure

```
app/          Expo Router screens — (tabs)/ holds the main tab navigator
components/   Reusable UI (modals, pickers, transaction rows, themed views)
services/     API client, auth (OAuth flow), workspace, export, secure storage
store/        Zustand stores — auth, loading, settings
hooks/        useTheme, useWorkspace
constants/    API config, colors, theme
utils/        Formatting helpers
```

## Backend Expectations

The app expects a backend exposing:

- `GET /api/auth/google` and `GET /api/auth/microsoft` — OAuth entry points that redirect back to `tressurer://auth/callback?token=<jwt>&user=<json>`
- `PATCH /api/auth/me` — profile updates
- Workspace/transaction/audit endpoints consumed via `services/api.js`

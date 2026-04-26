# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: Waydora

Italian-flavored conversational travel planner. Tagline: "Travel simple, everywhere!".

- `artifacts/waydora` — React + Vite frontend. Brand palette: deep blue `#1B4F8A` + warm orange `#FF8C42` on cream. Routes: `/` (home/planner with chat + suggestion cards) and `/trip/:slug` (saved itinerary with packing list + share link).
- `artifacts/api-server` — Express API. Routes: `/healthz`, `/chat` (OpenAI structured JSON itinerary generation), `/suggestions` (carousel prompts), `/templates` (4 full pre-built itineraries the user can clone & edit via chat — Barcellona 3gg low budget, Roma weekend romantico, Lisbona 4gg mid, Tokyo 7gg prima volta), `/itineraries` CRUD + `/itineraries/share/:slug`.
- `lib/db/src/schema/itineraries.ts` — single table storing the JSON itinerary blob with a public `shareSlug`.
- `lib/api-spec/openapi.yaml` — source of truth for typed hooks (`@workspace/api-client-react`) and Zod schemas (`@workspace/api-zod`).
- AI: uses the `openai` SDK pointed at the Replit AI Integrations proxy (`AI_INTEGRATIONS_OPENAI_*` env vars). Model `gpt-5.4` with `response_format: json_object`. Affiliate links are real provider search URLs (Booking, Airbnb, GetYourGuide, Viator).

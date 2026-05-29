# Execution Plan: Mobile Tamagui Migration + MetaMask-Inspired Architecture

## Objective

Refactor `apps/mobile` to use Tamagui as the primary UI system and reorganize frontend code into a cleaner, feature-first architecture inspired by MetaMask Mobile's modular structure.

## Why

The current mobile app mixes Ignite legacy patterns with NativeWind-first styling and broad `src/` folders. A Tamagui design system and clearer module boundaries will improve maintainability, consistency, and onboarding speed.

## Scope

- In scope:
  - Add Tamagui runtime/config to Expo app
  - Add a design-system layer for tokens and reusable primitives
  - Add a modular app structure (`core`, `features`, `design-system`)
  - Migrate at least one production route to Tamagui primitives as a reference
  - Update mobile docs and migration guidance
- Out of scope:
  - Full app-wide migration in one PR
  - Backend or agent runtime changes
  - Navigation model rewrites

## Constraints

- Architectural: Keep `apps/mobile` boundaries intact and preserve Expo Router routes.
- Reliability: Existing onboarding and tab navigation should continue to function.
- Security: No secrets or external credential changes.

## Work Plan

1. Discovery
2. Foundation wiring (Tamagui + provider stack)
3. Structure refactor (core/providers + design-system + feature modules)
4. Reference screen migration (Home tab)
5. Verification
6. Documentation updates

## Decision Log

- 2026-05-29: Start with incremental migration (foundation + one route) rather than full rewrite to reduce risk.
- 2026-05-29: Keep existing NativeWind paths temporarily to avoid blocking current screens; phase out per-feature.

## Progress Log

- 2026-05-29: Started plan and mapped current mobile structure.
- 2026-05-29: Added Tamagui configuration scaffold and app-level `AppProviders` wrapper.
- 2026-05-29: Refactored Home tab route to a thin wrapper and moved implementation to `src/features/home/screens/HomeTabScreen.tsx`.
- 2026-05-29: Extracted Home domain constants/helpers into `src/features/home/home.constants.ts` and `src/features/home/home.utils.ts`.
- 2026-05-29: Added Tamagui primitive layer at `src/design-system/primitives/index.tsx` to support component migration.
- 2026-05-29: Updated mobile README with migration architecture and structure conventions.

## Verification

- Commands run:
- `pnpm add ...` (failed in this environment: package manager binaries unavailable)
- `corepack pnpm --version || yarn --version || npm --version` (none available in current shell)
- Manual checks:
- Verified route `app/(tabs)/home.tsx` now delegates to `src/features/home/screens/HomeTabScreen.tsx`.
- Verified root layout now uses `src/core/providers/AppProviders.tsx`.
- Remaining risk:
- Tamagui dependencies were added to `package.json` but could not be installed or validated in this environment.

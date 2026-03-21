# Execution Plan: Mobile Moti Animation Bootstrap

## Objective

Add `moti` to the Expo mobile app, wire the required runtime setup, and apply a small production-facing animation so the dependency is exercised in the current UI.

## Why

The mobile prototype already uses Reanimated-powered interactions in a few places, but it does not yet have a simple, composable animation layer for screen transitions and entrance motion. Adding `moti` now keeps animation work aligned with the current Expo stack and gives the UI a reusable path for motion.

## Scope

- In scope:
  - Install `moti` in `apps/mobile`
  - Add any required Expo/Reanimated entry configuration for the current app shell
  - Apply a lightweight animation to an existing mobile surface
  - Record verification in this plan
- Out of scope:
  - Broad animation redesign across every tab
  - Navigation or state-management changes
  - New network or backend behavior

## Constraints

- Architectural: Keep changes within `apps/mobile` plus repository planning/docs artifacts.
- Reliability: Preserve current tab navigation and screen rendering behavior.
- Security: Add only the minimum third-party dependency required for the requested animation layer.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Use `moti` on top of the app's existing Expo + Reanimated stack instead of introducing a separate animation abstraction, and limit the first usage to subtle entrance motion on an existing tab surface.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Installed `moti` in `apps/mobile` using the existing pnpm store path to avoid a full reinstall.
- 2026-03-21: Added root entry imports for `react-native-reanimated` and the existing gesture-handler bootstrap in Expo Router's `app/_layout.tsx`.
- 2026-03-21: Applied staged `MotiView` entrance animations to the Home tab hero, holdings summary, and team section.
- 2026-03-21: Fixed two local `Text` prop type errors in `home.tsx` uncovered during compile verification.

## Verification

- Commands run:
- `pnpm -C apps/mobile add moti --store-dir /Users/chungquantin/Library/pnpm/store/v3`
- `pnpm -C apps/mobile exec prettier --write 'app/(tabs)/home.tsx'`
- `pnpm -C apps/mobile exec eslint app/_layout.tsx 'app/(tabs)/home.tsx'`
- `pnpm -C apps/mobile run compile`
- `python3 scripts/check_harness_readiness.py`
- Manual checks:
- Confirmed the Moti install requirement from the official docs and aligned the runtime setup with the app's Expo Router entrypoint.
- Remaining risk:
- Repo-wide TypeScript compilation still fails in pre-existing files outside this change: `app/(tabs)/portfolio.tsx`, `src/config/index.ts`, and `src/screens/DashboardScreen.tsx`.

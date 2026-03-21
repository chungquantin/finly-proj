# Execution Plan: Mobile Four Tabs and Agent Detail Flow

## Objective

Implement a four-tab mobile app shell (Home, Portfolio, Board, Settings) with mock investing content, plus agent detail navigation from Home cards/avatars.

## Why

The current app does not expose the requested bottom-tab IA or the central board chat flow. This slice creates a demo-ready information architecture aligned with the requested product walkthrough.

## Scope

- In scope:
  - Expo Router tab group for Home, Portfolio, Board, Settings
  - Mock content for each tab aligned to product narrative
  - Agent detail page reachable from Home team cards
- Out of scope:
  - Backend integration
  - Real-time chat transport
  - Persistent profile storage beyond current local store usage

## Constraints

- Architectural: Keep changes inside `apps/mobile` and Expo Router route conventions.
- Reliability: Preserve existing onboarding routes and avoid breaking app boot.
- Security: No new secrets, tokens, or external network dependencies.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Use Expo Router `(tabs)` group + dynamic `agent/[id]` route to keep navigation explicit and testable.
- 2026-03-21: Represent agent avatars with seeded random emoji and palette combinations so agent visuals feel random without changing between Home, Board, and detail screens.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Added route group `app/(tabs)/` with four tab routes and custom tab bar labels/icons.
- 2026-03-21: Implemented Home overview with portfolio status, performance snapshot, and four agent cards.
- 2026-03-21: Implemented Portfolio tab with positions and allocation mock data.
- 2026-03-21: Implemented Board tab with mock user-agent thread messages.
- 2026-03-21: Redesigned Board tab from stacked cards into an iMessage-style conversation layout with gradient outgoing bubbles, lightweight group header, inline reactions, and a docked composer row.
- 2026-03-21: Implemented Settings tab to update investor profile fields via onboarding store actions.
- 2026-03-21: Added dynamic `app/agent/[id].tsx` page and wired Home avatar/card taps to detail route.
- 2026-03-21: Updated root index route to redirect to `/(tabs)/home`.
- 2026-03-21: Updated settings reset behavior to restart onboarding at step 1 (`/onboarding/step-1`).
- 2026-03-21: Updated onboarding completion destination to Home (`/home` -> `/(tabs)/home` redirect).
- 2026-03-21: Removed legacy dashboard route/screen to avoid stale post-onboarding destination.
- 2026-03-21: Expanded mock agent profiles with richer descriptive fields, operating attributes, strengths, and watchlists.
- 2026-03-21: Refreshed the agent detail screen to surface agent bio, mission, operating profile, focus tags, strengths, and attribute metrics.
- 2026-03-21: Added Portfolio holdings sort controls for value, alphabet, and holdings count within the existing card UI.
- 2026-03-21: Normalized badge/tag/status text rendering onto the shared mobile `Text` primitive and added an explicit web system font family to stop serif fallback on pills and chip labels.
- 2026-03-21: Split Board into a thread inbox and a dedicated thread-detail route, backed by mock per-thread conversation data.
- 2026-03-21: Added holding detail route with board decision, intake summary, rationale, and related thread links, and made Portfolio holdings navigable into that detail view.

## Verification

- Commands run:
  - `pnpm -C apps/mobile run compile`
- Manual checks:
  - Navigation wiring reviewed: Home card/avatar press -> `/agent/[id]`.
  - Tab IA reviewed: Home, Portfolio, Board, Settings all have dedicated route files.
  - Board visual hierarchy reviewed in code: header, left/right message grouping, and composer row now match the supplied chat reference more closely than the prior card-list design.
  - Portfolio holdings sort state reviewed in code: value sorts by `valueUsd` descending, alphabet sorts by ticker ascending, holdings sorts by share count descending.
  - Badge/tag text rendering reviewed in code: Home status pills, Portfolio chips/sort pills, agent detail badges/tags, and shared UI badge/avatar/button labels now all use the shared `Text` component instead of mixed raw `Text` + ad hoc `fontFamily` styling.
  - Navigation wiring reviewed in code: Board thread cards push to `/thread/[id]`, and Portfolio holdings push to `/holding/[ticker]` with related thread deep links back into `/thread/[id]`.
- Remaining risk:
  - Thread and holding data are mock-only; once real orchestration exists, thread identity and decision snapshots should come from the same source of truth.

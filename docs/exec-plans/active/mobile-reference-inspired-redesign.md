# Execution Plan: Mobile Reference-Inspired Redesign

## Objective

Redesign Finly mobile toward the provided investment UI references while preserving the existing five-tab product structure and current portfolio behavior.

## Why

The app already has working mobile flows, but Home and Portfolio need a more polished, chart-forward investment interface with stronger visual hierarchy and a consistent tab shell.

## Scope

- In scope:
  - Shared reference-inspired mobile design tokens and lightweight finance UI primitives
  - Home and Portfolio redesigns using existing portfolio, market-data, and agent data
  - Visual normalization for Board, Heartbeat, Settings, and the bottom tab bar
- Out of scope:
  - Backend/API changes
  - Portfolio model changes
  - Navigation IA changes away from the current five tabs

## Constraints

- Architectural: Keep mobile calling existing backend APIs only; keep route contracts intact.
- Reliability: Preserve holdings, watchlist, thread, heartbeat, settings, and detail navigation behavior.
- Security: Do not add secrets, external credentials, or new data-vendor access from mobile.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-05-29: Keep five tabs and treat references as an inspired design system rather than a close clone.
- 2026-05-29: Add `react-native-svg` directly through Expo for rings and chart primitives.

## Progress Log

- 2026-05-29: Started plan.

## Verification

- Commands run:
- Manual checks:
- Remaining risk:

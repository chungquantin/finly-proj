# Execution Plan: iOS SwiftUI Bootstrap For AI Fund Launch Flow

## Objective

Add a deterministic repo-owned iOS SwiftUI bootstrap path and define the first product flow for an AI-operated investment fund experience with a three-step UI.

## Why

The repository currently supports only `web-nextjs` scaffolding and has no product spec. This work establishes an iOS app initialization path and encodes product intent before application behavior evolves.

## Scope

- In scope:
  - Add an `ios-swiftui` template for `scripts/bootstrap_codebase.py`
  - Scaffold a SwiftUI app skeleton for the 3-step flow
  - Add product and design documentation for the flow and visual style
  - Update relevant indexes and stack policy docs
- Out of scope:
  - Backend implementation for Python agent server runtime
  - Production networking, auth, or persistence
  - Voice transcription backend integration

## Constraints

- Architectural: Preserve mixed-language monorepo compatibility and deterministic bootstrap.
- Reliability: Keep generated app state transitions explicit and testable in code.
- Security: Do not add secrets or hardcoded credentials; keep integration points documented only.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-16: Use SwiftUI as default iOS profile and place generated app under `apps/ios` for monorepo compatibility.
- 2026-03-16: Encode a local mock-only flow for portfolio and agent views without external APIs to keep bootstrap deterministic.

## Progress Log

- 2026-03-16: Started plan.
- 2026-03-16: Added deterministic `ios-swiftui` stack support in bootstrap script and created repo-owned iOS SwiftUI template.
- 2026-03-16: Bootstrapped `apps/ios` and implemented 3-step UI flow with portfolio intake, dashboard, and per-agent detail view with local voice recording.
- 2026-03-16: Added product/design docs and updated architecture/frontend/engineering guide indexes and stack policy.

## Verification

- Commands run:
  - `python3 scripts/bootstrap_codebase.py --stack ios-swiftui --name finly-fund --target apps/ios`
  - `python3 scripts/check_harness_readiness.py`
  - `cd apps/ios && xcodegen generate` (failed: `xcodegen` not installed)
- Manual checks:
  - Confirmed `apps/ios` contains SwiftUI app entry, intake/dashboard/detail flow views, and AVFoundation recorder service.
- Remaining risk:
  - Xcode project generation and app runtime were not executed in this environment (`xcodegen` and iOS simulator not run).

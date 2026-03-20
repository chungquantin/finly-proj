# Execution Plan: Mobile Bento Kawaii-Fi Design System Alignment

## Objective

Codify the Bento-Grid Kawaii-Fi visual system in repository docs and update mobile theme tokens so future screens implement the same visual language consistently.

## Why

The mobile app currently mixes default scaffold styling with partially customized UI. A documented and tokenized system reduces drift and makes implementation repeatable across onboarding, chat, arena, and quest surfaces.

## Scope

- In scope:
  - Add a mobile design-system document under `docs/design-docs/`
  - Update design-doc indexes/references for discoverability
  - Update mobile theme tokens in `apps/mobile/app/theme/` (color semantics and layout primitives)
- Out of scope:
  - Full UI screen-by-screen redesign
  - New component library APIs beyond token plumbing
  - Animation refactor

## Constraints

- Architectural: Keep styling changes within existing `apps/mobile/app/theme` boundaries.
- Reliability: Preserve existing imports and avoid breaking app boot.
- Security: No external assets or credentials.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-20: Treat user-provided Bento-Grid Kawaii-Fi breakdown as design source input and encode it as repository-local system-of-record docs + theme tokens.

## Progress Log

- 2026-03-20: Started plan.
- 2026-03-20: Added `docs/design-docs/mobile-bento-kawaii-design-system.md` and linked it from design indexes/front-end guidance.
- 2026-03-20: Updated mobile theme tokens (`colors.ts`, `colorsDark.ts`, `spacing.ts`, `spacingDark.ts`) and added `radius.ts`.
- 2026-03-20: Extended theme typing/wiring to include radius tokens (`types.ts`, `theme.ts`).
- 2026-03-20: Updated active onboarding UI (`ThemeShowcaseScreen`, `OnboardingStep2Screen`) and shared UI primitives (`tailwind.config.js`, `ui/card.tsx`, `ui/button.tsx`) to consume the Bento-Kawaii token palette/radius/shadow system.

## Verification

- Commands run:
  - `cd apps/mobile && npx eslint app/theme/colors.ts app/theme/colorsDark.ts app/theme/theme.ts app/theme/types.ts app/theme/spacing.ts app/theme/spacingDark.ts`
  - `cd apps/mobile && npx eslint app/screens/ThemeShowcaseScreen.tsx app/screens/OnboardingStep2Screen.tsx app/components/ui/button.tsx app/components/ui/card.tsx tailwind.config.js`
  - `cd apps/mobile && npx eslint --fix app/screens/ThemeShowcaseScreen.tsx app/components/ui/card.tsx`
  - `cd apps/mobile && pnpm run compile`
  - `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Confirmed design docs index includes new mobile design-system document.
- Remaining risk:
  - Full TypeScript compile still fails due pre-existing missing dependency `expo-application` in `app/screens/DemoDebugScreen.tsx` (not introduced by this change).

# Execution Plan: Mobile onboarding chat prefill flow

## Objective

Ensure onboarding chat only pre-fills investor profile fields and then routes users through the 3-step onboarding flow: investor profile, account selection, and complete.

## Why

Current chat completion jumps directly to the final complete step, skipping key user confirmation steps and causing unexpected onboarding behavior.

## Scope

- In scope:
  - Update chat completion and skip transitions to route into investor profile step.
  - Prevent chat step from auto-selecting account/portfolio defaults.
  - Add a dedicated onboarding route for investor profile screen.
- Out of scope:
  - Redesigning onboarding UI content or adding new profile fields.
  - Backend onboarding chat schema changes.

## Constraints

- Architectural:
  - Keep route structure inside `apps/mobile/app/onboarding`.
- Reliability:
  - Preserve existing store writes for known profile fields.
- Security:
  - No security-sensitive changes.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-22: Reused existing investor profile UI (`ThemeShowcaseScreen`) as onboarding step target instead of introducing a new screen implementation, to keep the fix minimal and aligned with previous flow behavior.
- 2026-03-22: Added explicit onboarding progression flags in store and guarded complete step route so stale state or alternate navigation cannot bypass investor profile/account selection.

## Progress Log

- 2026-03-22: Started plan.
- 2026-03-22: Updated chat onboarding transitions to route into investor profile review.
- 2026-03-22: Added `/onboarding/investor-profile` route that reuses the existing investor profile screen.
- 2026-03-22: Removed automatic stock account defaults from chat completion/skip path.
- 2026-03-22: Added route-entry guard on complete step and progression flags set by investor-profile/account-selection actions.

## Verification

- Commands run:
  - `pnpm -C apps/mobile compile` (fails due to unrelated, pre-existing TypeScript errors in other files)
  - `pnpm -C apps/mobile exec eslint app/onboarding/investor-profile.tsx src/screens/OnboardingChatScreen.tsx` (pass)
  - `pnpm -C apps/mobile exec eslint src/screens/OnboardingChatScreen.tsx src/screens/ThemeShowcaseScreen.tsx src/screens/OnboardingStep2Screen.tsx src/screens/OnboardingCryptoWalletScreen.tsx src/screens/OnboardingCompleteScreen.tsx src/stores/onboardingStore.ts src/stores/onboardingStore.test.ts app/onboarding/investor-profile.tsx` (pass)
  - `pnpm -C apps/mobile test -- onboardingStore.test.ts` (fails due to pre-existing test setup import issue: missing `../app/i18n/index.ts`)
- Manual checks:
  - N/A (not run in simulator in this session)
- Remaining risk:
  - Investor profile route currently reuses `ThemeShowcaseScreen`; if that screen is later repurposed, onboarding route ownership should be split into a dedicated screen file.
  - Existing app/test baseline has unrelated TypeScript and Jest setup errors, so end-to-end automated validation remains partial.

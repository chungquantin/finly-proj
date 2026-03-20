# Execution Plan: Mobile NativeWind + Shadcn-Style UI Foundation

## Objective

Set up the React Native app with NativeWind (Tailwind-style utilities), theme tokens, and reusable shadcn-style primitives. Deliver an initial home screen styled to match the provided pastel, rounded, card-first visual direction.

## Why

The current mobile scaffold uses default Ignite styling patterns. This setup is needed to accelerate consistent UI implementation for the target design system and upcoming product screens.

## Scope

- In scope:
  - Install and configure NativeWind + Tailwind in `apps/mobile`
  - Add CSS variable-driven color tokens and theme wiring
  - Add shadcn-style primitives (`Button`, `Card`, `Avatar`, `Badge`, `Input` baseline)
  - Implement/update the main app screen with a UI starter matching the provided theme reference
  - Document setup and usage in mobile docs
- Out of scope:
  - Full feature parity with the full multi-screen mock
  - API/data integration
  - Production animation system or navigation restructuring

## Constraints

- Architectural: Keep changes localized to `apps/mobile` and align with existing Expo Router structure.
- Reliability: Preserve app boot path and avoid breaking existing test setup.
- Security: No secrets or remote credentials; local UI-only changes.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-19: Use NativeWind + class-variance-authority to emulate shadcn-style component APIs in React Native.

## Progress Log

- 2026-03-19: Started plan.
- 2026-03-19: Installed `nativewind`, `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, and `expo-linear-gradient` in `apps/mobile`.
- 2026-03-19: Wired NativeWind into Babel/Metro and added Tailwind config + global CSS entry.
- 2026-03-19: Added shadcn-style UI primitives and `ThemeShowcaseScreen`, then routed home screen to showcase.
- 2026-03-19: Updated mobile README with setup and file map.
- 2026-03-19: Reworked home screen into onboarding profile step UI (risk expertise, horizon selection, financial knowledge, continue CTA) matching the provided first-screen mock direction.
- 2026-03-19: Integrated `zustand` persisted store (`app/stores/onboardingStore.ts`) backed by MMKV and connected onboarding screen selections to persisted state.
- 2026-03-19: Wired Step 1 `Continue` action to Expo Router path `/onboarding/step-2` and added Step 2 screen showing persisted onboarding selections.
- 2026-03-19: Replaced Step 2 with Import Portfolio UI (option cards for screenshot/manual/csv), added persisted `importMethod` in onboarding store, and disabled Continue until selection.

## Verification

- Commands run:
- `cd apps/mobile && pnpm add nativewind class-variance-authority clsx tailwind-merge tailwindcss`
- `cd apps/mobile && pnpm add -D tailwindcss@3.4.17`
- `cd apps/mobile && npx expo install expo-linear-gradient`
- `cd apps/mobile && pnpm exec eslint --fix src/app/_layout.tsx src/app/index.tsx app/screens/ThemeShowcaseScreen.tsx app/components/ui/*.tsx app/lib/utils.ts metro.config.js babel.config.js tailwind.config.js`
- `cd apps/mobile && pnpm exec eslint --fix app/stores/onboardingStore.ts app/screens/ThemeShowcaseScreen.tsx`
- `cd apps/mobile && pnpm exec eslint --fix app/screens/ThemeShowcaseScreen.tsx app/screens/OnboardingStep2Screen.tsx src/app/onboarding/step-2.tsx`
- `cd apps/mobile && pnpm run compile` (fails due pre-existing missing dependency: `expo-application` imported by `app/screens/DemoDebugScreen.tsx`)
- Manual checks:
- NativeWind configuration paths and route wiring verified by file inspection.
- Remaining risk:
- Full TypeScript compile is currently blocked by existing missing module `expo-application`; not introduced by this UI setup slice.

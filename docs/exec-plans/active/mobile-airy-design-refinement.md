# Execution Plan: Mobile Airy Design Refinement

## Objective

Refine the current mobile UI to a more airy, mobile-friendly look aligned with the provided reference, while preserving existing onboarding and dashboard behavior.

## Why

Current screens are functional but visually dense and inconsistent with the requested soft, spacious financial-mobile style. A focused refinement improves readability, hierarchy, and visual trust.

## Scope

- In scope:
  - Add reusable airy screen wrapper primitives for consistent spacing/hero treatment
  - Update onboarding and dashboard surfaces to use lighter card hierarchy and breathing room
  - Keep current data/state/navigation behavior intact
- Out of scope:
  - New business logic
  - Navigation architecture changes
  - New chart libraries or major animation systems

## Constraints

- Architectural: Keep changes within existing `apps/mobile` UI/screen boundaries.
- Reliability: Preserve onboarding flow state transitions and dashboard mock data rendering.
- Security: No credential, network, or external asset additions.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Implement airy styling as compositional wrappers plus local class/style changes to avoid broad token churn.
- 2026-03-21: Shift mobile typography to Apple system typography on iOS (San Francisco rendering via system font) and reduce oversized display text to the repo's iOS-native scale.
- 2026-03-21: Refine the main mobile tabs toward Rainbow Wallet's visual language using SF-style system typography, pastel atmospheric backdrops, white frosted cards, compact circular action buttons, and token-list hierarchy.
- 2026-03-21: Treat `Board` tab text rendering as the working reference path because it uses direct `react-native` `Text`, then bring the shared `@/components/Text` wrapper into NativeWind interop so class-based font and color styling works consistently across the main app.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Added reusable airy layout shell (`AiryScreenShell`) for consistent gradient hero, safe-area handling, and scroll spacing.
- 2026-03-21: Refined onboarding screens (`OnboardingPortfolioTypeScreen`, `OnboardingStep2Screen`, `OnboardingCryptoWalletScreen`, `OnboardingCompleteScreen`) with softer hierarchy, larger spacing, and mobile-first card/pill actions.
- 2026-03-21: Refined `DashboardScreen` to match airy finance-mobile composition (hero greeting, elevated balance card, quick actions, insight strip, transaction list, bottom dock treatment).
- 2026-03-21: Updated visual direction to a white Family-style pass (light surfaces, soft top gradients, navy accents) per latest user preference.
- 2026-03-21: Fine-tuned onboarding + dashboard to a cleaner Family-inspired white interface (reduced visual noise, flatter cards, calmer accent usage, green primary CTAs).
- 2026-03-21: Redesigned tab-based main app (`home`, `portfolio`, `board`, `settings`, tabs layout) to iOS-native grouped/floating navigation style and preserved reset-onboarding action in Settings.
- 2026-03-21: Added reusable iOS header primitive and refreshed onboarding step 1 to match the same iOS-native visual language.
- 2026-03-21: Added repository-local design guidance `docs/design-docs/mobile-ios-native-family-style.md` and linked it from indexes/frontend guidance.
- 2026-03-21: Reworked four-tab app information architecture per user spec:
  - Home: hero + status/performance + agent team + My Bots section
  - Portfolio: user portfolio summary and holdings list
  - Board: main thread with mock user/agent messages
  - Settings: investor profile update controls + onboarding reset
- 2026-03-21: Upgraded tab bar from placeholder text glyphs to icon-based navigation and refreshed agent detail page.
- 2026-03-21: Replaced Space Grotesk-driven mobile typography with system typography, updated shared text sizing tokens, and reduced oversized headings/buttons across onboarding and core tabs.
- 2026-03-21: Restyled the tab shell, home, portfolio, board, settings, and agent detail routes to follow a Rainbow-inspired wallet composition while keeping Finly's product structure.
- 2026-03-21: Reworked onboarding step 1 (`ThemeShowcaseScreen`) to match the live dashboard/tabs visual system with a wallet-style hero card, SF-scale typography, blue selection pills, and grouped white surfaces.
- 2026-03-21: Fixed the shared `Text` wrapper by adding NativeWind `cssInterop` so `className` styles render correctly outside the `Board` screen; refreshed core tab colors toward the Rainbow reference palette while keeping layout and data unchanged.
- 2026-03-21: Expanded the `home` tab's "Your Team" section from a two-column card grid to full-width stacked cards with stronger hierarchy, larger message text, and clearer metadata for easier mobile scanning.
- 2026-03-21: Pulled the `home` tab's "Your Team" module out of the main portfolio container into an absolute full-width bottom sheet with a pull-up/full-screen expanded state and independent agent-list scrolling.
- 2026-03-21: Replaced the static team-sheet toggle with a draggable snap header and added elevated shadow styling so the sheet reads and behaves like a floating layer.

## Verification

- Commands run:
  - `pnpm -C apps/mobile exec eslint src/components/AiryScreenShell.tsx src/screens/DashboardScreen.tsx src/screens/OnboardingPortfolioTypeScreen.tsx src/screens/OnboardingStep2Screen.tsx src/screens/OnboardingCryptoWalletScreen.tsx src/screens/OnboardingCompleteScreen.tsx`
  - `pnpm -C apps/mobile run compile`
  - `pnpm -C apps/mobile exec eslint app/(tabs)/_layout.tsx app/(tabs)/home.tsx app/(tabs)/portfolio.tsx app/(tabs)/board.tsx app/(tabs)/settings.tsx src/components/IosHeader.tsx src/screens/ThemeShowcaseScreen.tsx src/screens/OnboardingPortfolioTypeScreen.tsx src/screens/OnboardingStep2Screen.tsx src/screens/OnboardingCryptoWalletScreen.tsx src/screens/OnboardingCompleteScreen.tsx src/components/AiryScreenShell.tsx`
  - `pnpm -C apps/mobile run compile`
  - `pnpm -C apps/mobile exec eslint app/_layout.tsx app/(tabs)/home.tsx app/(tabs)/portfolio.tsx app/(tabs)/board.tsx app/(tabs)/settings.tsx src/components/IosHeader.tsx src/components/Text.tsx src/screens/OnboardingPortfolioTypeScreen.tsx src/screens/OnboardingStep2Screen.tsx src/screens/OnboardingCryptoWalletScreen.tsx src/screens/OnboardingCompleteScreen.tsx src/theme/typography.ts`
  - `pnpm -C apps/mobile exec prettier --write app/(tabs)/_layout.tsx app/(tabs)/home.tsx app/(tabs)/portfolio.tsx app/(tabs)/board.tsx app/(tabs)/settings.tsx app/agent/[id].tsx src/components/IosHeader.tsx`
  - `pnpm -C apps/mobile run compile`
  - `pnpm -C apps/mobile exec eslint app/(tabs)/_layout.tsx app/(tabs)/home.tsx app/(tabs)/portfolio.tsx app/(tabs)/board.tsx app/(tabs)/settings.tsx app/agent/[id].tsx src/components/IosHeader.tsx`
  - `pnpm -C apps/mobile exec eslint src/screens/ThemeShowcaseScreen.tsx`
  - `pnpm -C apps/mobile run compile`
  - `pnpm -C apps/mobile exec eslint --fix src/components/Text.tsx app/(tabs)/board.tsx app/(tabs)/portfolio.tsx app/(tabs)/home.tsx app/(tabs)/settings.tsx src/components/IosHeader.tsx app/(tabs)/_layout.tsx src/theme/colors.ts src/theme/typography.ts`
  - `pnpm -C apps/mobile exec eslint src/components/Text.tsx app/(tabs)/board.tsx app/(tabs)/portfolio.tsx app/(tabs)/home.tsx app/(tabs)/settings.tsx src/components/IosHeader.tsx app/(tabs)/_layout.tsx src/theme/colors.ts src/theme/typography.ts`
  - `pnpm -C apps/mobile exec eslint app/(tabs)/home.tsx`
- `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Confirmed onboarding flow navigation targets remained unchanged (`/onboarding/step-3/*`, `/onboarding/step-4`, `/dashboard`).
- Remaining risk:
  - Visual parity with the exact reference may still need final device-level tuning (font rendering and spacing on smaller phones).
  - Repo-wide TypeScript compile still has pre-existing failures outside this change (`src/config/index.ts`, `src/screens/DashboardScreen.tsx`, `src/utils/playAudio.ts`), so this pass validates the affected UI files with eslint rather than a clean global compile.

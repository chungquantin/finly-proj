# Frontend

Frontend guidance now targets the Finly hackathon MVP.

## Current Target Surface (Hackathon MVP)

- React
- TypeScript
- Tailwind CSS
- Agora Web SDK for voice

Use a responsive single-page flow for:

1. Onboarding
2. Team chat transcript
3. Arena battle
4. Quest flow
5. Leaderboard

## Voice UX Baseline

- Always provide text fallback when voice fails
- Show explicit state transitions (`listening`, `processing`, `speaking`, `fallback`)
- Track latency targets (voice interaction <2s, full 4-agent response <3s)

## Data Visualization Baseline

- Keep charts simple and interpretable (battle portfolio growth bars, clash score meter)
- Prioritize clarity over dense analytics

## Mobile Design System

- Follow `docs/design-docs/mobile-bento-kawaii-design-system.md` for:
  - token palette and semantic color usage
  - bento spacing/radius rules
  - typography behavior and numeric readability
  - component tone (playful + high-clarity fintech)

## Accessibility Baseline

- Text equivalents for all voice outputs
- High contrast defaults
- Large tap/click targets
- Keyboard-navigable primary actions

## Bootstrap Notes

When bootstrapping repo-owned web surfaces, prefer deterministic templates via `scripts/bootstrap_codebase.py` (`web-nextjs`) before external scaffolding.

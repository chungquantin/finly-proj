# iOS AI Fund Flow UI

## Context

This document defines the first iOS UI implementation for the AI fund launch experience specified in `docs/product-specs/ai-fund-team-launch-flow.md`.

## Visual Language

- Minimal layout density
- Flat illustration-inspired agent characters
- Neutral background and high-contrast text
- Restrained animation limited to agent liveness cues

## Screen Architecture

1. Intake screen
2. Dashboard screen
3. Agent detail screen

Navigation is linear from intake to dashboard, with per-agent drill-in from dashboard to detail.

## Component Model

- `FundLaunchFlowView`
  - Owns step state and selected agent
- `IntakeView`
  - Captures risk, holdings, amount, horizon
- `DashboardView`
  - Shows synthetic trend line and four agent windows
- `AgentWindow`
  - Role card with lightweight animated character representation
- `AgentDetailView`
  - Full-view character and voice recording control
- `VoiceRecorderService`
  - Encapsulates AVFoundation recording and permission state

## Motion

- Agent windows use a small vertical bob animation to imply active presence.
- Motion should remain subtle and never block data legibility.

## Accessibility Baseline

- High-contrast foreground on light background
- Large touch targets for primary actions
- Clear step labeling (`Step 1 of 3`, `Step 2 of 3`, `Step 3 of 3`)

## Integration Boundaries

- iOS app handles view state and local recording.
- Python agent server will handle uploaded demand processing and agent orchestration.

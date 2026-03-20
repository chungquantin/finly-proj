# Mobile Bento Kawaii-Fi Design System

## Status

Active

## Context

This document defines the visual system for the Finly mobile app UI kit. It translates the Bento-Grid Kawaii-Fi direction into implementation-ready tokens and rules.

## Design Intent

- Playful and approachable for beginner investors
- High clarity for financial and educational information
- Reward-forward interaction style with visible progress and celebration

## Visual Language

- Soft base surfaces with vibrant accent moments
- Bold rounded cards and pill controls
- Friendly, mascot-compatible composition without visual clutter
- Structured bento layouts with generous breathing room
- Sky-and-cloud hero headers with floating circular highlights for emotional warmth
- Profile-centric composition with avatar overlap and centered name/value hierarchy

## Color System

### Base

- App background: `#F9F9F9`
- Surface: `#FFFFFF`
- Primary text: `#1A1A1A`
- Secondary text: `#666666`

### Actions And States

- Primary action purple: `#A855F7`
- Primary soft purple: `#D8B4FE`
- Energetic yellow: `#FFD233`
- Success green: `#4ADE80`
- Error red: `#C03403`

### Pastel Widget Surfaces

- Pink pastel: `#FFCFE1`
- Blue pastel: `#DBEAFE`
- Warm pastel: `#FEF3C7`
- Cloud neutral: `#F3F4F6`

### Gradient Usage

- Header sky gradient: `#9EDCFF -> #8BCBFF`
- CTA gradient: `#FDBA74 -> #FB7185 -> #E879F9`
- Large amount styling:
  - Currency symbol uses sky blue
  - Amount uses action purple

## Typography

- Primary family: Space Grotesk (already loaded in app)
- Heading behavior: bold to extra-bold visual weight
- Body behavior: regular/medium for readability
- Numeric behavior: monospaced fallback via `theme.typography.code`

## Layout And Shape

- Screen gutter target: `20-24px`
- Card radius target: `24px`
- Hero/modal radius target: `32px`
- Nested element radius target: `16px`
- Button style: pill or high-radius rounded rectangle

## Component Guidance

- Primary button:
  - Use purple solid or purple-to-pink gradient
  - Keep high contrast white label
- Secondary button:
  - Use white or pastel fill with light border
- Charts:
  - Prefer smooth curves and rounded stroke caps
- Progress:
  - Use thick tracks and rounded ends
- Feedback:
  - Positive outcomes should use color + celebratory copy/character treatment

## Onboarding Composition Pattern

- Use a single rounded container card (`32px` radius) on a soft neutral background.
- Add a top hero block with:
  - sky gradient
  - cloud blobs
  - warm circular sun accent
- Place avatar badge overlapping hero and content.
- Surface key amount in oversized typography near the top third of content.
- Use row-based detail lines with clear left labels and right values.
- Primary actions:
  - two rounded pills near top for fast mode switching
  - one gradient full-width CTA at bottom

## Interaction Tone

- Keep progress visible (streaks, levels, milestones)
- Reward completion with clear visual and textual confirmation
- Maintain plain-language explanations for financial context

## Implementation Mapping

- Theme token source: `apps/mobile/app/theme/`
- Core token files:
  - `colors.ts`
  - `spacing.ts`
  - `radius.ts`
  - `typography.ts`

## Notes

- This system is intentionally light mode first for hackathon delivery.
- If dark mode is introduced, preserve semantic contrast and reward cues.

# Color Audit

## Compliance Score: 6/10

## Summary
The application demonstrates strong adherence to PandaDoc's emerald primary color (#248567) and generally follows the brand palette. However, several non-compliant colors from generic design systems (slate, indigo, violet, blue, purple) are used throughout, violating the brand consistency principle. The max 2 brand colors per composition rule is frequently exceeded, particularly in complex UI sections.

## Compliant

- Emerald #248567 used correctly for primary CTAs, active states, and success indicators
- Brand color palette properly defined in Tailwind config (emerald, amethyst, coral, sand)
- Correct use of #242424 (brand black) for primary text
- Sand #F8F5F3 appropriately used for backgrounds and surfaces
- Amethyst #A496FF used for AI/innovation contexts (AI Analysis sections)
- Coral #FF8B6C used for warmth and alerts (stakeholder pain points, gaps)
- White #FFFFFF used for card backgrounds and surfaces
- WCAG AA contrast generally maintained for primary text on light backgrounds

## Non-Compliant

| Issue | Current | Expected | File:Line |
|-------|---------|----------|-----------|
| Slate color family used | slate-50 through slate-900 | Sand palette or emerald neutrals | Multiple files throughout |
| Indigo colors for AI elements | indigo-50, indigo-500, indigo-600, indigo-700 | Amethyst palette (#A496FF variations) | RubricSection.tsx:48,98-106; TranscriptInput.tsx:59; QAChecklist.tsx:15 |
| Violet colors for features | violet-100, violet-600 | Amethyst palette | LandingPage.tsx:31-32 |
| Purple colors for stats | purple-50, purple-600 | Amethyst palette | Dashboard.tsx:170-171 |
| Blue colors for collaboration | blue-50, blue-100, blue-600 | Emerald or amethyst | LandingPage.tsx:51-52; AssessmentHistory.tsx:119 |
| Generic orange colors | orange-50 through orange-900 | Coral palette (#FF8B6C variations) | RubricSection.tsx:33,84-92; App.tsx:542 |
| Yellow/amber for warnings | yellow-50, yellow-600, fef9c3, 854d0e | Should use coral 20/30 for warnings | SharedWithMe.tsx:52-68; App.tsx:161,509,542 |
| Green colors outside brand | green-500, emerald-50/600/700 | Should standardize on #248567 and emerald palette | QAChecklist.tsx:31; SharedWithMe.tsx:51; TrendsView.tsx:42,72 |
| Red colors for errors | red-50, red-100, red-500, red-600, red-700 | Coral 40 (#FF8B6C) for alerts | Multiple files; AnalysisModal.tsx:111; AssessmentHistory.tsx:26; TranscriptInput.tsx:112 |
| Excessive brand colors | 3-4 colors in single view | Max 2 per composition | App.tsx stakeholder cards (emerald, amethyst, coral, sand all used) |
| Non-brand overlay | rgba(0,0,0,0.5), bg-slate-900/50 | Should use brand-appropriate overlay | App.tsx:186; AnalysisModal.tsx:61; AssessmentHistory.tsx:135 |

## Contrast Concerns

**Generally Compliant:**
- Primary text (#242424) on white backgrounds: ~15.8:1 (exceeds WCAG AAA)
- Emerald (#248567) on white: ~4.9:1 (passes WCAG AA for normal text)
- Sand-10 (#F8F5F3) backgrounds with dark text: adequate contrast

**Potential Issues:**
- Amethyst-40 (#A496FF) on white: ~3.2:1 - FAILS WCAG AA for normal text (4.5:1 required)
  - Used in App.tsx:777-781 for heading text
  - Recommendation: Use for decorative elements only or increase font weight/size
- Emerald-40 (#87B5A7) text on white: ~2.8:1 - FAILS WCAG AA
  - Used extensively for secondary labels and metadata text
  - Recommendation: Increase to emerald primary or use brand black
- Coral-40 (#FF8B6C) on white: ~3.1:1 - FAILS WCAG AA for normal text
  - Used for pain points and alerts
  - Recommendation: Acceptable for large text (18px+) or bold, otherwise use darker coral

## Recommendations

1. **Eliminate generic design system colors**: Replace all slate, indigo, violet, blue, purple references with PandaDoc brand palette equivalents (sand for neutrals, amethyst for innovation/AI contexts, emerald for primary actions).

2. **Standardize neutral grays**: Use sand palette (30: #D4C7B1, 20: #EEE9E1, 10: #F8F5F3) instead of slate colors for borders, backgrounds, and neutral UI elements. For text, use brand black #242424 with opacity variations if needed.

3. **Fix contrast violations**: Replace emerald-40 and amethyst-40 text with brand black (#242424) or emerald primary (#248567) where used for body text. Reserve lighter tints for backgrounds, borders, and large/bold text only.

4. **Reduce brand color density**: In stakeholder cards and complex sections, limit to 2 brand colors maximum. Consider using emerald + one accent (amethyst OR coral) rather than mixing all colors in single components.

5. **Create brand-compliant error/warning system**: Replace red error colors with coral-40 (#FF8B6C), yellow warnings with coral-20 (#FFC9BF) or coral-10 (#FFEAE7), and use emerald variations for success states consistently.

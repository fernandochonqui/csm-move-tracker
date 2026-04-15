# Typography Audit

## Compliance Score: 7/10

## Summary
The application demonstrates strong compliance with PandaDoc typography guidelines. Font implementation is correct with proper Graphik LC Web loading and fallbacks. However, several critical issues exist: incorrect font family reference ("Graphik LC Web" vs "Graphik LC Alt Web"), inconsistent heading hierarchies that deviate from specifications, and extensive use of Tailwind's generic slate/gray colors instead of PandaDoc's defined grays (#6B7280, #9CA3AF).

## Compliant

- Font faces correctly loaded: Bold (700), Semibold (600), Regular (400)
- System fallback chain properly configured: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif
- Body text uses 400 weight consistently
- Antialiasing enabled globally
- Monospace usage for technical content (transcript textarea)
- Semantic color usage for interactive states

## Non-Compliant

| Issue | Current | Expected | File:Line |
|-------|---------|----------|-----------|
| Font family name | "Graphik LC Web" | "Graphik LC Alt Web" | index.html:12-33, index.html:40 |
| H1 size/weight | 32-60px mixed, 700 weight | 32px, 700 weight, #242424 | LandingPage.tsx:12, App.tsx:385 |
| H2 size/weight | 18-24px, 600-700 weight | 24px, 600 weight, #242424 | App.tsx:775,186; TrendsView.tsx:99,147 |
| H3 size/weight | 18-21px, 600-700 weight | 28px, 700 weight, #242424 | RubricSection.tsx:20; AssessmentHistory.tsx:90,138; TranscriptInput.tsx:63 |
| Body primary | Uses slate-600/slate-700 | 16px, 400 weight, #6B7280 | Multiple files - using Tailwind generic grays |
| Body secondary | Uses slate-400/slate-500 | 14px, 400 weight, #9CA3AF | Multiple files - using Tailwind generic grays |
| Text color classes | text-slate-* variants | Should use #242424 for primary, #6B7280 for gray, #9CA3AF for light gray | All component files |
| Header title inconsistency | "text-xl font-bold" (20px) | Should follow H2 spec: 24px, 600 weight | App.tsx:385; RubricSection.tsx:20 |
| Mixed heading usage | Mixes h1, h3 without h2, inconsistent sizes | Follow clear H1→H2→H3 hierarchy | LandingPage.tsx, App.tsx |
| PDF export typography | Uses Poppins font | Should maintain Graphik LC Alt Web or acceptable fallback | App.tsx:181 |

## Recommendations

1. **Update font family reference**: Change all instances from "Graphik LC Web" to "Graphik LC Alt Web" in index.html (lines 12, 20, 29, 40) to match official PandaDoc guidelines.

2. **Standardize heading hierarchy**: Implement strict H1/H2/H3 sizing - H1: 32px/700, H2: 24px/600, H3: 28px/700. Replace Tailwind size classes (text-xl, text-lg) with exact pixel values or custom utilities.

3. **Replace Tailwind grays with PandaDoc colors**: Create Tailwind config utilities for `text-pd-gray` (#6B7280), `text-pd-light-gray` (#9CA3AF), `text-dark` (#242424) and replace all `text-slate-*` instances.

4. **Fix PDF export font**: Update handleExportPDF function (App.tsx:181) to reference Graphik LC Alt Web instead of Poppins, or ensure proper fallback chain.

5. **Enforce color consistency**: Audit all color usages - primary text should be #242424 (black), not generic slate-* variants. Create a comprehensive color mapping from Tailwind to PandaDoc specs.

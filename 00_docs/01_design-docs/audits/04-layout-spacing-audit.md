# Layout & Spacing Audit

## Compliance Score: 6/10

## Summary
The application demonstrates strong adherence to PandaDoc spacing units (4, 6, 8) and vertical rhythm patterns, but deviates significantly from specified container widths and header specifications. The current implementation uses max-w-7xl containers instead of the specified max-w-2xl/4xl strategy, and employs non-standard spacing values (p-5, space-y-3) in several components.

## Header
**Status: NON-COMPLIANT**

- **Height:** INCORRECT - Uses h-16 (64px) ✓ matches spec
- **Background:** INCORRECT - Uses `bg-white/80 backdrop-blur-md` instead of solid `bg-white`
- **Border:** CORRECT - Uses 1px bottom border ✓
- **Logo Placement:** INCORRECT - No 24px padding from edges specified in design
- **Layout:** CORRECT - Logo left, actions right ✓
- **Sticky Positioning:** NOT SPECIFIED - Uses `sticky top-0 z-30` (acceptable enhancement)

**Issues:**
- Line 376 (App.tsx): Semi-transparent background (`bg-white/80`) with backdrop blur not in spec
- Line 377: Uses `max-w-7xl` container instead of full-width header
- Line 377: Custom padding `px-4 sm:px-6 lg:px-8` instead of standard 24px

## Container Widths

| Element | Current | Expected | Status |
|---------|---------|----------|--------|
| Main Container | max-w-7xl | Varies by content | ❌ INCORRECT |
| Input Screen | max-w-7xl | max-w-2xl (640px) | ❌ INCORRECT |
| Editor Canvas | N/A | max-w-4xl (896px) | ⚠️ NOT APPLICABLE |
| Modals | max-w-md | max-w-md (448px) | ✓ CORRECT |
| Landing Page Grid | max-w-4xl | Not specified | ℹ️ ACCEPTABLE |

**Critical Issues:**
- **App.tsx Line 484:** Main container uses `max-w-7xl` instead of content-specific widths
- **App.tsx Line 493:** Form view uses 3-column grid without max-w-2xl constraint
- **TranscriptInput.tsx:** No max-w-2xl constraint on input screen
- **RubricSection.tsx:** No max-w-4xl constraint on editor canvas
- **AssessmentHistory.tsx:** Uses implicit full-width instead of specified container

## Spacing Consistency

| Area | Issue | File:Line |
|------|-------|-----------|
| Header Padding | Uses responsive `px-4 sm:px-6 lg:px-8` instead of 24px | App.tsx:377 |
| Vertical Rhythm | Uses `space-y-8` (32px) instead of `space-y-6` (24px) | App.tsx:496 |
| Card Padding | Uses `p-5` (20px) non-standard spacing | RubricSection.tsx:55, 68, 84, 98, 109 |
| List Spacing | Uses `space-y-3` (12px) instead of standard units | RubricSection.tsx:73, AssessmentHistory.tsx:94 |
| Modal Padding | Uses `p-6` (24px) - CORRECT ✓ | AssessmentHistory.tsx:136 |
| Section Margins | Uses `mb-8` (32px) instead of `space-y-6` (24px) | RubricSection.tsx:14 |
| Grid Gaps | Uses `gap-6` (24px) - CORRECT ✓ | App.tsx:550, RubricSection.tsx:66 |
| Grid Gaps | Uses `gap-3` (12px) - non-standard but acceptable | LandingPage.tsx:29 |
| Card Internal | Uses `gap-4` (16px) - CORRECT ✓ | TranscriptInput.tsx:57, TrendsView.tsx:58 |
| Button Padding | Uses `px-8 py-3` (32px/12px) mixed with spec | TranscriptInput.tsx:125 |

**Non-Standard Spacing Values Found:**
- `p-5` (20px) - appears 5+ times across RubricSection.tsx
- `space-y-3` (12px) - AssessmentHistory.tsx:94, multiple locations
- `gap-3` (12px) - Acceptable for tight groupings
- `py-5` (20px) - TranscriptInput.tsx:57, App.tsx:580

**Correct Usage:**
- `space-y-6` (24px) - App.tsx:800, 820 (AI summary cards)
- `space-y-4` - Used correctly for within-component groups
- `p-6` (24px) - Modal padding (AssessmentHistory.tsx:136)
- `p-8` (32px) - Major section padding (App.tsx:484, RubricSection.tsx:16)

## Grid & Responsive

**Layout Strategy:**
- Uses CSS Grid with responsive columns: `grid-cols-1 lg:grid-cols-3` (App.tsx:493)
- Sidebar uses `lg:col-span-1` with sticky positioning
- Form content uses `lg:col-span-2`

**Responsive Breakpoints:**
- sm: Used for 2-3 column grids in stats (TrendsView.tsx:58)
- md: Used for 2-column content splits (RubricSection.tsx:17, 66)
- lg: Primary breakpoint for main layout shift

**Issues:**
- No specified sidebar width of 280px found
- No Sand-10 (#F8F5F3) sidebar background (not applicable - no sidebar)
- Responsive padding uses `sm:px-6 lg:px-8` instead of fixed 24px
- Landing page grid correctly uses `sm:grid-cols-3` for feature cards

**Strengths:**
- Proper mobile-first approach with `grid-cols-1` defaults
- Consistent use of `gap-6` (24px) for major grid spacing
- Sticky sidebar scorecard at `top-24` provides good UX

## Vertical Rhythm Analysis

**Between Form Elements (Expected: 24px / space-y-6):**
- ❌ App.tsx:496 - Uses `space-y-8` (32px) instead of `space-y-6`
- ✓ Within component groups correctly uses 16px (`space-y-4`)

**Within Component Groups (Expected: 16px):**
- ✓ App.tsx:800, 806 - Correctly uses `space-y-4` for list items
- ✓ RubricSection.tsx:73 - Uses `space-y-3` for tight quote lists
- ⚠️ Some components use `mb-8` for bottom margins instead of parent `space-y-6`

## Header Specifications Detailed Review

**Current Implementation (App.tsx:376-482):**
```
✓ Fixed top positioning
✓ White background (with transparency issue)
✓ 1px bottom border
✓ h-16 height
✓ Logo left placement
✓ Actions right placement
❌ backdrop-blur-md not in spec
❌ bg-white/80 instead of solid bg-white
❌ Border color uses #EEE9E1 (Sand) - should confirm if acceptable
```

## Recommendations

1. **Implement Content-Specific Containers:** Replace `max-w-7xl` with context-aware container widths: `max-w-2xl` for TranscriptInput and form sections, `max-w-4xl` for assessment results and scorecard areas.

2. **Standardize Spacing Values:** Replace all instances of `p-5` (20px) with standard values from the approved set (p-4, p-6, p-8). Convert `space-y-3` to `space-y-4` for component groups and `space-y-6` for form elements.

3. **Fix Header Implementation:** Remove `bg-white/80 backdrop-blur-md` and replace with solid `bg-white`. Ensure 24px padding from edges for logo placement. Consider adding explicit left/right padding constraints.

4. **Correct Vertical Rhythm:** Change main layout from `space-y-8` to `space-y-6` (App.tsx:496). Audit all bottom margins (`mb-8`) and convert to parent-controlled spacing where appropriate.

5. **Document Responsive Spacing:** Create guidelines for when responsive padding (`px-4 sm:px-6 lg:px-8`) is acceptable versus fixed 24px spacing, or standardize to one approach throughout the application.

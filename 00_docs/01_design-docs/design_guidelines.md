# Design Guidelines: Marketing Campaign Content Generator

## Design Approach
**Reference-Based**: Apple Human Interface Guidelines - Clean, minimalist productivity tool
**Rationale**: Internal marketing productivity application requiring clarity, efficiency, and professional polish

## Core Design Principles
1. **Minimalist Efficiency**: Remove visual noise, focus on task completion
2. **Brand Consistency**: Strict adherence to PandaDoc color palette with emerald as primary accent
3. **Immediate Clarity**: Zero learning curve, self-explanatory interfaces
4. **Professional Trust**: Enterprise-grade polish befitting a marketing tool

## Color Palette

### Primary Brand Colors
- **Emerald (#24B567)**: Primary brand color - CTAs, active states, success indicators, brand accents
- **Amethyst (40: #A496FF)**: Wisdom/innovation contexts - use sparingly for accent
- **Coral (40: #FF8B6C)**: Warmth/human-centric elements - notifications, highlights
- **Sand (#F8F5F3)**: Backgrounds, cards, paper-like surfaces
- **Black (#242424)**: Primary text, high-contrast elements
- **White (#FFFFFF)**: Backgrounds, reversed text

### Neutral Grays
- **Primary Text**: #6B7280
- **Secondary Text**: #9CA3AF
- **Borders**: #E5E7EB, #D1D5DB

## Typography System
**Primary Font**: Graphik LC Alt Web (with system fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)

**Hierarchy**:
- **H1 (Page Headers)**: 32px, weight 700, black (#242424)
- **H2 (Section Titles)**: 24px, weight 600, black (#242424)
- **H3 (Content Headlines)**: 28px, weight 700, black (#242424)
- **Body Primary**: 16px, weight 400, gray (#6B7280)
- **Body Secondary**: 14px, weight 400, light gray (#9CA3AF)
- **Labels**: 14px, weight 500, gray (#374151)

## Layout & Spacing
**Tailwind Units**: 4, 6, 8, 12, 16, 24 (p-4, p-6, m-8, space-y-6, etc.)

**Container Strategy**:
- Campaign List/Input: max-w-2xl (640px) centered
- Workspace/Editor: max-w-4xl (896px) with subtle shadow
- Modals: max-w-md (448px) centered overlay

**Vertical Rhythm**: 24px between major sections, 16px within component groups

## Component Library

### Forms & Inputs
- **Text Inputs**: White bg, 1px border (#E5E7EB), h-12, px-4, emerald focus ring, rounded-lg
- **Dropdowns**: Same styling, chevron icon, emerald hover on options
- **Textarea**: Min 2-row expanding to 5-row max, character counter
- **Labels**: 14px weight 500, gray, mb-2

### Buttons
- **Primary**: Emerald (#24B567) bg, white text, h-12, px-6, rounded-lg, hover darkens (#1F9A57)
- **Secondary**: Gray outline, gray text, same dimensions
- **Disabled**: 50% opacity

### Cards & Containers
- **Campaign Cards**: White bg, shadow-sm, rounded-lg, p-6, hover:shadow-md transition
- **Generated Content**: White bg, shadow-lg, rounded-lg, p-8 (paper-like)
- **Sidebar**: 280px width, Sand (#F8F5F3) bg, collapsible

### Progress & Feedback
- **Vertical Stepper**: Left-aligned icons, emerald active, gray completed
- **Loading**: Subtle pulse on panda icon
- **Auto-save**: "All changes saved" (green) / "Saving..." (spinner) in top-right
- **Toasts**: Bottom-right, emerald success, red error, 5s auto-dismiss

### Modals
- **Overlay**: rgba(0,0,0,0.5)
- **Content**: White, rounded-2xl, p-8, max-w-md
- **Icons**: 48px, green checkmark (success), red alert (error)

## Icons & Images
- **Icon System**: Google Material Symbols (Sharp variant, 24px)
- **Logo**: PandaDoc emerald logomark + wordmark with ®
- **No Hero Images**: Utility-focused, no marketing imagery
- **Customer Logos**: Grayscale, max-h-12, color on hover

## Navigation & Interactions
- **Header**: Fixed top, white, 1px border bottom, h-16
- **Transitions**: Smooth (0.2s), minimal animation
- **Focus States**: Emerald ring (ring-2 ring-emerald-500)
- **Hover**: Subtle darken/highlight only

## Accessibility
- WCAG AA contrast (4.5:1 text, 3:1 large text)
- Visible labels and ARIA attributes
- Keyboard navigation with emerald focus outlines
- Screen reader announcements for progress

## Content Voice
- **Bold**: Confident, modern, approachable
- **Progressive**: Solution-focused, benefit-led
- **Transparent**: Direct, no hedge words
- **Logical**: Clear arguments for immediate needs

**Avoid**: Formal jargon, pain-point framing, excessive formality
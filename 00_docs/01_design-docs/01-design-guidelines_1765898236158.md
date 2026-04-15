# Design Guidelines: AI Sales Collateral Generator

## Design Approach
**Reference-Based**: Apple Human Interface Guidelines - Clean, minimalist productivity tool
**Rationale**: Internal sales productivity application requiring clarity, efficiency, and professional polish

## Core Design Principles
1. **Minimalist Efficiency**: Remove visual noise, focus on task completion
2. **Brand Consistency**: Strict adherence to PandaDoc color palette with emerald as primary accent
3. **Immediate Clarity**: Zero learning curve, self-explanatory interfaces
4. **Professional Trust**: Enterprise-grade polish befitting a sales tool

## Color Palette

### Primary Brand Colors
| Color | Primary | 40 | 30 | 20 | 10 |
|-------|---------|----|----|----|----|
| **Emerald** | #248567 | #87B5A7 | #B9CDC7 | #CDD5D9 | #E7F6EE |
| **Amethyst** | — | #A496FF | #C5BCFF | #D6CEFF | #EEE8FF |
| **Coral** | — | #FF8B6C | #FFB3A6 | #FFC9BF | #FFEAE7 |
| **Sand** | — | — | #D4C7B1 | #EEE9E1 | #F8F5F3 |

### Neutral Colors
- **Black**: #242424 (primary text, high contrast)
- **White**: #FFFFFF (backgrounds, reversed text)

### Color Usage Guidelines
- **Emerald (#24B567)**: Primary brand color - CTAs, active states, success indicators, brand accents
- **Amethyst**: Wisdom/innovation contexts - use sparingly for accent
- **Coral**: Warmth/human-centric elements - notifications, highlights
- **Sand (#F8F5F3)**: Backgrounds, cards, paper-like surfaces
- **Black (#242424)**: Primary text, high-contrast elements
- Maximum 2 brand colors per composition for visual harmony
- Ensure WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)

## Typography System
**Primary Font**: Graphik LC Alt Web (with system font fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)

**Font Weights**:
- Bold (700): Primary headlines, marketing materials, hero sections
- Semibold (600): Secondary headlines, subheadings, section titles
- Regular (400): Body copy, paragraphs, supporting text

**Hierarchy**:
- H1 (Page Headers): 32px, weight 700 (Bold), black (#242424)
- H2 (Section Titles): 24px, weight 600 (Semibold), black (#242424)
- H3 (Generated Content Headlines): 28px, weight 700 (Bold), black (#242424)
- Body Primary: 16px, weight 400 (Regular), gray (#6B7280)
- Body Secondary: 14px, weight 400 (Regular), light gray (#9CA3AF)
- Monospace (Filenames/Codes): System monospace, 13px

## Layout & Spacing
**Tailwind Units**: Consistent use of 4, 6, 8, 12, 16, 24 for spacing (p-4, p-6, m-8, etc.)

**Container Strategy**:
- Input Screen: max-w-2xl (640px) centered
- Editor Canvas: max-w-4xl (896px) with paper-like shadow
- Modals: max-w-md (448px) centered overlay

**Vertical Rhythm**: 24px (space-y-6) between form elements, 16px within component groups

## Component Library

### Forms & Inputs
**Text Inputs**: White background, 1px border (#E5E7EB), h-12, px-4, emerald focus ring, rounded-lg
**Dropdowns**: Identical styling to text inputs, chevron-down icon, emerald hover (#E7F6EE) on options
**Textarea**: 2-row minimum expanding to 5-row maximum, character counter bottom-right
**Labels**: 14px weight 500, gray (#374151), mb-2

### Buttons
**Primary**: Emerald (#24B567) background, white text, h-12, px-6, rounded-lg, weight 500, hover darkens to #1F9A57
**Secondary**: Gray outline (1px #D1D5DB), gray text (#6B7280), same dimensions
**Disabled State**: 50% opacity, no pointer events

### Progress Indicators
**Vertical Stepper**: Left-aligned icons (checkmark/spinner/circle), emerald for active, gray for completed/upcoming
**Timer**: Monospace font, live-updating elapsed time display
**Loading States**: Subtle pulse animation on panda icon

### Editor Components
**Editable Text**: Thin emerald border on focus, inline editing, preserve formatting
**Auto-save Indicator**: Green "All changes saved" or spinner "Saving..." in top-right
**Sidebar**: 280px width, collapsible, Sand-10 background (#F8F5F3)

### Modals
**Overlay**: Semi-transparent black (rgba(0,0,0,0.5))
**Content Box**: White, rounded-2xl, p-8, max-w-md, centered
**Icons**: Success (green checkmark), Error (red alert), 48px size
**Modal Actions**: Two-button pattern - primary right, secondary left

## Generated Document Structure
**Paper Container**: White background, subtle shadow (shadow-lg), rounded corners, p-8

**Sections**:
1. Headline: 28px bold, emerald accent underline
2. Subheadline: 16px gray below headline
3. Value Props: Emerald checkmark bullets, 3 items, space-y-4
4. Use Cases: Sand-10 cards (#F8F5F3), rounded-lg, p-4, grid layout
5. Customer Logos: Grayscale row with 24px gap, hover shows color
6. CTA Footer: Emerald background, white text, p-6, rounded-b-lg

## Navigation & Flow
**Header Bar**: Fixed top, white background, 1px bottom border, h-16, logo left, actions right
**Breadcrumb Pattern**: "[Company Name] One-Pager" centered in header
**Screen Transitions**: Smooth URL updates without full reload, maintain scroll position

## Interactions & Animations
**Minimal Animation Policy**: Use sparingly for feedback only
- Button hover: Subtle darken (0.2s transition)
- Focus states: Emerald ring appears (0.15s)
- Modal entry: Fade in overlay + scale content (0.2s)
- Progress steps: Smooth icon transitions (0.3s)

**No Scroll Animations**: Keep interface static and predictable

## Accessibility
- All inputs have visible labels and ARIA attributes
- Keyboard navigation with emerald focus outlines (ring-2 ring-emerald-500)
- WCAG AA contrast ratios throughout
- Screen reader announcements for progress updates

## Responsive Behavior
**Desktop-First** (768px+ focus):
- Tablet: Sidebar becomes bottom drawer, reduce padding
- Mobile (future): Stack all layouts, full-width buttons

## Session & State Management
**Persistence Indicators**:
- "Resume previous session?" dialog on return
- Auto-save status always visible in editor
- Character counters update live

## Error Handling
**Error Modal Pattern**: Red icon, specific message, error code, "Try Again" + "Contact Support" buttons
**Inline Validation**: Show validation messages below inputs in red (#EF4444)
**Confirmation Dialogs**: "Are you sure?" pattern for destructive actions

## Images & Icons

### Icons
**Icon System**: Google Material Symbols (Sharp variant) - https://fonts.google.com/icons
**Specifications**: Weight 400, Fill Off, Grade Normal, Optical Size 24dp
**Sizes**: 20px for inline, 24px standard, 48px for modals
**Style**: Sharp/Outlined only - never rounded or filled
**Usage Rules**:
- Icons enhance comprehension, rarely stand alone
- Match icons to specific concepts being communicated
- Maintain consistent size and alignment within layouts
- Only use colors from the brand palette
- Never stretch, distort, or add effects to icons

### Logo
**Primary Logo**: Logomark (emerald square with "pd") + Wordmark ("PandaDoc®")
**Mandatory**: Always include ® symbol in all logo applications
**Safe Zone**: Minimum clear space = x/3 (height of lowercase 'd') on all sides
**Color Variations**:
- Emerald logomark + Black wordmark (default on light backgrounds)
- White logo (on dark/emerald backgrounds)
- Black logo (on bright backgrounds)
**Logo Placement**: 24px padding from edges, appears on all screens

### Other Images
**No Hero Images**: This is a utility application - no marketing imagery needed
**Customer Logos**: Grayscale treatment with color on hover, max-h-12, object-contain

## Content Voice & Tone

When generating text content (headlines, CTAs, microcopy), follow PandaDoc's verbal identity:

**Target Audience**: Millennials (28-43), SMBs, ethnically diverse - casual, frank, internet-literate

**Voice Attributes**:
- **BOLD**: Modern, approachable, human - confident in initiating conversations
- **PROGRESSIVE**: Solution-focused, positive - lead with benefits, not pain points
- **TRANSPARENT**: Direct, succinct - avoid hedge words ("might," "suggest," "may")
- **LOGICAL**: Clear, concise arguments that speak to immediate needs

**Writing Style**:
- Use casual, contemporary language
- Be direct and to-the-point
- Lead with solutions and benefits
- Sound modern, approachable, and human

**Avoid**:
- Fussy, formal business language
- Pain-point framing ("Struggling with...?")
- Hedge words and corporate jargon
- Excessive formality or sentimentality

---

## Reference Documents

For detailed brand specifications, consult:
- `pandadoc-brand-colors.md` - Complete color palette with hex/RGB/CMYK/Pantone values
- `pandadoc-typography-guidelines.md` - Graphik LC Alt Web font specifications
- `pandadoc-icons-brand-guide.md` - Google Material Symbols usage guidelines
- `pandadoc-logo-brand-guide.md` - Logo variations, safe zones, and usage rules
- `pandadoc-verbal-identity-guide.md` - Brand voice, tone, and messaging guidelines

---

**Design Completion Note**: This is a complete, production-ready design system aligned with official PandaDoc brand guidelines. Every screen, component, and interaction has been specified for immediate implementation.
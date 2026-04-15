# Components Audit

## Compliance Score: 6/10

## Summary
The application demonstrates strong color consistency with PandaDoc emerald as the primary accent, but deviates significantly from design guidelines in input styling, button specifications, and modal implementations. Most components use Tailwind's slate/gray scale instead of the specified neutral colors, and button dimensions/hover states don't match the spec.

## Buttons
| Status | Issue | File:Line |
|--------|-------|-----------|
| Non-compliant | Primary button uses gradient instead of solid #248567, hover not #1F9A57 | TranscriptInput.tsx:125 |
| Non-compliant | Primary button missing h-12 height specification | TranscriptInput.tsx:125 |
| Non-compliant | Secondary button uses slate colors instead of #D1D5DB border / #6B7280 text | TranscriptInput.tsx:71 |
| Non-compliant | CTA button in LandingPage uses gradient, not solid emerald | LandingPage.tsx:23 |
| Non-compliant | Modal buttons don't follow primary/secondary spec | AnalysisModal.tsx:127 |
| Non-compliant | Share button uses generic brand-500 instead of #248567 | AssessmentHistory.tsx:173 |
| Compliant | Export/Reset buttons use proper emerald hover states | App.tsx:448-466 |

## Inputs
| Status | Issue | File:Line |
|--------|-------|-----------|
| Non-compliant | Text input uses slate-50 background instead of white | TranscriptInput.tsx:93 |
| Non-compliant | Text input uses slate-200 border instead of #E5E7EB | TranscriptInput.tsx:93 |
| Non-compliant | Search input missing h-12 height specification | AssessmentHistory.tsx:81 |
| Non-compliant | Account input uses #F8F5F3 (Sand) instead of white background | App.tsx:561 |
| Partial | Email input in share modal has correct white bg but wrong border | AssessmentHistory.tsx:158 |
| Non-compliant | Textarea uses slate-50 background instead of white | AnalysisModal.tsx:101 |
| Compliant | Focus rings correctly use emerald primary color throughout | Multiple files |

## Cards
| Status | Issue | File:Line |
|--------|-------|-----------|
| Compliant | Main cards use white bg with shadow-soft (shadow-lg equivalent) | App.tsx:499, 853 |
| Partial | Cards use border-slate-100 instead of #EEE9E1 | RubricSection.tsx:14 |
| Partial | Stakeholder cards use correct rounded corners and shadows | App.tsx:591 |
| Non-compliant | QA Checklist card uses slate-200 border instead of subtle border | QAChecklist.tsx:13 |
| Compliant | Dashboard stat cards have proper rounded-2xl and padding | Dashboard.tsx:146-176 |

## Modals
| Status | Issue | File:Line |
|--------|-------|-----------|
| Compliant | Share modal overlay uses rgba(0,0,0,0.5) backdrop | AssessmentHistory.tsx:135 |
| Compliant | Share modal content is white, rounded-2xl, max-w-md | AssessmentHistory.tsx:136 |
| Partial | Analysis modal uses slate-900/50 instead of black/50 overlay | AnalysisModal.tsx:61 |
| Partial | Modal content has correct styling but missing p-8 padding spec | AnalysisModal.tsx:62 |
| Non-compliant | No 48px success/error icons present in modals | N/A |
| Partial | Modal actions present but not following two-button pattern strictly | AssessmentHistory.tsx:161-176 |

## Recommendations

1. **Standardize Button Specifications**: Replace all gradient buttons with solid #248567 background, enforce h-12 height, px-6 padding, and #1F9A57 hover state as per guidelines. Update TranscriptInput.tsx:125, LandingPage.tsx:23, and AnalysisModal.tsx:127.

2. **Fix Input Backgrounds**: Change all text input backgrounds from slate/sand colors to pure white (#FFFFFF) with 1px #E5E7EB borders. Critical files: TranscriptInput.tsx:93, App.tsx:561, AnalysisModal.tsx:101.

3. **Unify Neutral Color System**: Replace Tailwind's slate colors (slate-100, slate-200, etc.) with PandaDoc's neutral palette (#E5E7EB for borders, #EEE9E1 for subtle dividers). This affects 15+ components.

4. **Implement Icon Specifications**: Add success/error modals with 48px icons (CheckCircle2, AlertCircle) following the design spec. Currently no modal uses the specified 48px icon pattern.

5. **Enforce Height Standards**: Add explicit h-12 to all primary inputs and buttons. Currently only some components specify height, leading to inconsistent UI density across the application.

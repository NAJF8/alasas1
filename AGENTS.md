# AL ASAS — Agent Instructions & Design Resources

Scope: `NAJF8/alasas1` (public website and admin). This document guides agents; it does not authorize uncontrolled dependency changes, production deployment or destructive operations.

## Product and brand requirements
- Brand: **الأساس | AL ASAS**; tagline **من الأساس تبدأ الفكرة**. Keep the existing approved geometric Arabic-alif logo and brand assets; do not replace them with generated or placeholder logos.
- Palette: Charcoal Black `#111111`, Warm Ivory `#F4F1E8`, Electric Lime `#B7FF2A`, Concrete Gray `#737373`, White `#FFFFFF`. Preserve accessibility and readable contrast.
- Premium, intentional, human-designed visual language. Avoid generic AI-looking gradients, ornamental glow, random glassmorphism, template hero layouts, and inconsistent icon weights.
- Support responsive layouts, Arabic RTL and English LTR; keep current dark/light/system themes and saved language/theme preferences functional.
- Do **not** decide the final typeface until the owner supplies its name. Use the current font in the meantime; do not silently swap it.
- Customer website should support products-for-sale (plans/prices/subscriptions/trials/purchase) and completed portfolio works (descriptions/images/links, with no default pricing). Maintain clear separation from the admin dashboard.
- Aim for full admin control over editable content/sections, but honor existing authorization, backend schema and publication workflow; never fake persistence.

## User-provided Figma references
1. [Social Media Icons — Logos (Community)](https://www.figma.com/design/eyqkXUj5B7iouOi8J9GJ3d/Social-Media-Icons---Logos--Community-?node-id=0-1&m=dev&t=toRv3xCMvLMQA2yv-1) — social/platform logo reference.
2. [Apple Maps Icon](https://www.figma.com/community/file/1001027181465580332/apple-maps-icon?q_id=44b00b25-c096-4dc0-9c3d-18d254f83dd3) — map/location visual reference.
These are **references only**. Verify community asset license, attribution and export permissions before copying icons or assets into the repository.

## Recommended resources — use selectively, not by default
| Resource | URL | Appropriate use |
| --- | --- | --- |
| Lucide | https://lucide.dev/icons/ | Consistent interface icons |
| Simple Icons | https://simpleicons.org/ | Recognizable brand/platform marks |
| SVG Repo | https://www.svgrepo.com/ | Supplementary SVGs after license review |
| Figma Community | https://www.figma.com/community | Components and layout references |
| shadcn/ui | https://ui.shadcn.com/ | Accessible customizable admin UI patterns |
| Radix Primitives | https://www.radix-ui.com/primitives | Accessible low-level interactions |
| Motion | https://motion.dev/ | Subtle, purposeful React animations |
| Google Fonts | https://fonts.google.com/ | Font research only; final font pending |
| Stripe design | https://stripe.com/ | Interaction/content hierarchy inspiration |
| Linear | https://linear.app/ | Dense, deliberate product UI inspiration |
| Apple Design Resources | https://developer.apple.com/design/resources/ | Precision, icons and platform guidance |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | Accessibility verification |
| web.dev | https://web.dev/ | Performance, responsiveness and UX guidance |

## Execution requirements
1. Inspect the current app, dependencies, routes, CSS, design tokens, auth, admin controls and deployment setup before modifying them.
2. Reuse existing libraries/components where possible; links above do **not** require installing dependencies. Request-specific requirements take precedence over visual inspiration.
3. Check asset license, attribution, SVG safety, external asset provenance and bundle impact before adding assets.
4. Maintain RTL/LTR symmetry, keyboard navigation, focus visibility, color contrast, touch sizing, reduced-motion preference, semantics and mobile layouts.
5. Centralize palette/spacing/radius/shadow/typography tokens. Avoid duplicate style systems or hard-coded inconsistent colors.
6. Use meaningful hover/transition states, not excessive scroll animations, autoplay effects or motion that obscures content.
7. All admin CRUD must be real, validated and permission-checked; verify create/edit/delete persists after reload. Avoid breaking existing customer data.
8. Run relevant build, lint, tests and smoke checks. Report exactly what was tested and what remains unverified.
9. Use a dedicated staging branch and reviewable PR for substantive changes; never deploy to production or merge automatically solely because these design references exist.
10. Do not insert API keys, tokens, credentials, personal data or secret endpoint configurations into this file.

## Follow-up
- Add new owner-provided resource links under the relevant subsection, with one sentence explaining their intended use.
- Final font choice remains pending explicit owner selection.
- Reference collection does not imply that any visual redesign, package install, admin feature or deployment has been completed.

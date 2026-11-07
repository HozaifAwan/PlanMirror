# PayPal design reference for PlanMirror

Expanded November 5, 2026 with a fresh public HTML/CSS inspection. The **Verified theme reference and implementation specification** below is the current implementation guide. The earlier browser samples are retained as historical observations; they are not a complete PayPal design system.

Inspected November 5, 2026, using browser computed styles on the public US homepage. This is a reference for the observed homepage and its controls. Other PayPal products and responsive layouts can differ. [Source homepage](https://www.paypal.com/us/home)

## Verified computed styles

| Element | Observed value |
| --- | --- |
| Hero heading family | PayPal Pro, Century Gothic, Helvetica, Arial, sans-serif |
| Hero heading weight | 900 |
| Hero heading size at inspected viewport | 57.6429px |
| Hero heading line height | 63.4072px, approximately 1.1 |
| Hero letter spacing | -1.72929px, approximately -0.03em |
| Hero text color | rgb(0, 0, 0) |
| Primary action family | PayPal Pro Text VF, Helvetica, Arial, sans-serif |
| Primary action size / weight / line height | 16px / 700 / 24px |
| Primary action padding | 12px 20px |
| Primary action fill / text | Black / white |
| Primary action corner radius | 1000px |
| Cookie secondary action border | 2px solid rgb(207, 211, 216) |
| Cookie secondary action padding / radius | 10px 30px / 1000px |
| Cookie secondary action transition | Color, background, and border color over 0.2s |

Values describe specific inspected elements. The cookie button is an example of a secondary control, rather than evidence that every secondary button uses the same styling.

## Visual organization

- The homepage uses a white canvas with prominent black typography.
- The hero centers its headline, supporting sentence, and primary action.
- Rounded labels and pill-shaped controls contrast with tightly tracked headings.
- Generous whitespace separates the header, hero, and subsequent content.
- Blue imagery and broad colored surfaces supply emphasis around neutral controls.
- Typography carries the hierarchy with large bold headings and quieter supporting copy.

## PlanMirror implementation

Sai owns the page styling (updated team assignment). Sebastian should coordinate dashboard surfaces and heading hierarchy with these tokens.

- Use the local Century Gothic / Helvetica / Arial fallback stack.
- Use fluid hero typography with weight 900, line height 1.1, and letter spacing -0.03em.
- Match the inspected primary action’s padding, radius, text size, and black-and-white contrast.
- Keep the workflow visually distinct with a light-blue brand surface and white cards; the verified fill below replaces the earlier approximate pale blue.
- Keep keyboard focus visible and permit touch controls at least 44px high.
- Stack the workflow cards on small screens and keep the hero readable at narrow widths.
- Retain PlanMirror branding and subscription-audit wording.

The workflow composition, responsive breakpoints, focus geometry, and card layout are PlanMirror choices. The current workflow fill is sampled from the theme, as documented below. PayPal’s proprietary font files were not imported. Font appearance will depend on which fallback is available locally.

## Extending the scaffold

Use the variables in `app/globals.css` for canvas, text, accents, borders, and supporting surfaces. Apply `pm-hero-title` and `pm-primary-action` to new components when their role matches. Keep findings status colors separate from decorative brand accents. Validate text contrast and keyboard navigation when adding interactive features.

## Layout reference from Safari

Rechecked the public US homepage in Safari on November 5, 2026. Its page structure follows this sequence.

1. A horizontal navigation header places the brand at the left, audience menus in the middle, and help and account actions at the right.
2. A centered audience selector precedes the hero headline, supporting sentence, and primary action.
3. A wide photographic campaign panel anchors the first screen.
4. Large editorial sections alternate product imagery, short benefit statements, and contextual actions.
5. Related features form groups of cards or panels.
6. Send, receive, and pool content is grouped by task.
7. A final app promotion leads into utility navigation and detailed disclosures.

For PlanMirror, use an audit workflow link in the header, a centered audit headline, and a prominent action that scrolls to the workflow. Future dashboard screens should keep compact controls close to their evidence. The campaign photography and financial-product promotions are specific to PayPal’s homepage.

## Colors and typography

The computed heading and primary-action values above were read from the public page in the previous inspection. The original scaffold implemented black foreground, white primary surfaces, a blue accent, gray labels, and an approximate pale blue workflow panel. The current implementation uses the verified semantic values below. The exact PlanMirror colors are centralized in the CSS theme.

PayPal’s observed heading and text families are proprietary brand fonts. PlanMirror uses locally available Century Gothic, Helvetica, and Arial. Match hierarchy through size, weight, spacing, and line height. Visual matching will vary with the fallback font.

## Buttons and icons

Primary actions use short verb-led labels and a solid pill shape. Secondary navigation and labels have quieter surfaces. The audience navigation uses small downward chevrons to signal expandable menus. Keep the chevron beside the relevant text, and rotate it only when a working menu changes state.

An original compact chevron can be drawn with an inline SVG.

```tsx
<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
  <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
</svg>
```

Use an accessible text label on every action. Decorative SVGs should be hidden from assistive technology. An icon-only control needs an accessible name. Add navigation arrows only where the control navigates or expands content.

## Original implementation examples

These examples express the observed visual patterns in independent CSS for the team to reuse.

```css
/* Centered editorial hero */
.audit-hero {
  max-width: 72rem;
  margin-inline: auto;
  padding: clamp(3rem, 7vw, 6rem) 1.5rem;
  text-align: center;
}

.audit-hero h1 {
  max-width: 48rem;
  margin-inline: auto;
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

/* Inspected primary action geometry, expressed as a reusable class */
.audit-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 12px 20px;
  border-radius: 1000px;
  background: #000;
  color: #fff;
  font: 700 16px / 24px Helvetica, Arial, sans-serif;
}

.audit-action:focus-visible {
  outline: 2px solid #005eb8;
  outline-offset: 4px;
}
```

## Team application

Sai can extend the header, hero, spacing, and responsive interface. Sebastian can carry the same colors, heading scale, and control shapes into AG Studio. Hozaif coordinates shared CSS changes. The reference captures visible design patterns and sampled computed values. It contains original implementation examples rather than a source archive.

## Verified theme reference and implementation specification

### Evidence, provenance and limits

This update retrieved the public US homepage HTML and the linked CSS on November 5, 2026. These are **declared CSS values**, not newly measured browser-computed styles: the browser host was unavailable. The earlier Safari/browser samples above were not independently reproduced. Media queries, cascade, page variant, geography and installed fonts can change the rendered result. Public marketing styles do not establish the entire internal PayPal product design system.

Primary sources:

- [PayPal US homepage](https://www.paypal.com/us/home): current HTML links the `paypal60` marketing theme; the text hierarchy is a headline, short support copy and focused CTA, followed by grouped product sections.
- [PayPal business page](https://www.paypal.com/us/business): business-specific hierarchy with a concise lead, paired actions and benefit groups. Its product content is not PlanMirror content.
- [PayPal theme CSS, paypal60-DJqhL8L_](https://www.paypalobjects.com/marketing/pp-com-components-pds60/themes/paypal60-DJqhL8L_.css): `.paypal60` typography, component geometry and `.paypal60-palette .white-plate` / blue plate semantic colors. This is the source for the tables below.
- [PayPal helper CSS, helpers-D6s78pYR](https://www.paypalobjects.com/marketing/pp-com-components-pds60/component-chunks/helpers-D6s78pYR.css): grid, typography and control implementations. Theme-specific selectors can override generic helper rules; do not sample a generic rule in isolation.
- [Homepage hero CSS, HomepageHero-Cvb27bqe](https://www.paypalobjects.com/marketing/pp-com-components-pds60/component-chunks/HomepageHero-Cvb27bqe.css): campaign-specific media, responsive layouts and animation. It is a reference for variation, not a requirement to reproduce its campaign.
- [Pentagram's PayPal identity case study](https://www.pentagram.com/work/paypal/story): primary design-agency account of the refreshed identity. It explains the geometric PayPal Pro family and utility text family, a black/white foundation with blue accents, and payment-gesture-inspired motion. PlanMirror adopts the visual principles, not the brand assets or promotional claims.
- [PayPal accessibility statement](https://www.paypal.com/re/webapps/mpp/accessibility?locale.x=en_AU): documents keyboard access, logical focus, descriptive links, contrast and zoom support, with WCAG 2.2 AA as an ongoing goal. This is a regional statement, not a certification of this application.
- [PayPal newsroom media resources](https://newsroom.paypal-corp.com/media-resources): official current logo/photography source if an authorized use is needed. PlanMirror retains its own wordmark and uses no downloaded PayPal logo or font.

Downloaded CSS SHA-256 anchors (hashes identify this inspection, not a promise the hosted files never change):

```text
theme:   70907781a9f1221fbaeee1b7f38f47949608fc69ad7de260c6cd88cebd9d6168
helpers: d29baf5715743586483ad04b539604199a6528975f3f8fad22fe3a322cbccc18
hero:    f805c460c5548404acf70ff563900ab7f4a21584a0f2cbfc0aa6a8d95e96fddb
```

These references are inspectable source links, not runtime stylesheet dependencies. Implementation is independent CSS. Font files and complete vendor stylesheets are not copied into the repository. Older PayPal Open, legacy dark-blue buttons or yellow checkout examples should not silently override this selected `paypal60` reference; integrations can have different requirements.

### Semantic color system

The following values are read from the theme's white plate unless stated otherwise. Eight-digit hex values include alpha: they must be composited on their actual surface, not treated as opaque RGB.

| Theme token / role | Verified value | PlanMirror mapping |
| --- | --- | --- |
| `style-background` | `#ffffff` | `--color-canvas`, main page and cards |
| `style-general-text`, `style-headline-text` | `#000000` | `--color-ink` |
| `style-general-text-muted` | `#000000a1` | `--color-muted`, composited on its surface |
| `style-background-alt` | `#0537820a` | `--color-wash`, subtle neutral-blue wash |
| `style-background-surface-alt` | `#05378214` | `--pm-surface`, labels and secondary actions |
| `style-border-color`, `style-stroke-color` | `#00000029` | `--color-line`, decorative separators |
| `style-focus-color`, `component-link` | `#0066f5` | `--color-accent`, focus and small brand accent |
| `style-fill-1` | `#002991` | `--color-brand-deep`, reserved stronger brand surface |
| `style-fill-2` | `#60cdff` | `--color-brand-light`, workflow section |
| Blue-600 plate background | `#002991` | If used later: white text, light-blue highlights, light-blue focus |
| Blue-600 plate focus | `#3db5ff` | Use on dark blue instead of white-plate focus |

The previous `#005eb8`, `#48617e`, `#d5e3f2`, and `#d9f3ff` values were PlanMirror approximations, not established PayPal tokens. Current CSS replaces them. Do not assume the faint decorative border meets control-boundary contrast requirements: form controls need a separately validated visible boundary.

### Typography and font substitution

Declared theme families are `PayPal Pro` for headings and `PayPal Pro Text VF` for body/controls. Heading weight is 900; body is 400 and strong text 700. Headings use `-0.03em` tracking; ordinary text and controls use `-0.015em`. These declarations confirm the earlier heading/control samples while removing false precision tied to one viewport.

Selected fluid scales from the `.paypal60` selectors:

| Selector suffix | Size declaration in theme | Line height |
| --- | --- | --- |
| `heading-text-size-headline-3` | `clamp(2.65625rem, 5.91518vw - 1.12946rem, 5.96875rem)` | `1.1` |
| `heading-text-size-headline-5` | `clamp(2rem, 3.23661vw - .0714286rem, 3.8125rem)` | `1.1` |
| `heading-text-size-headline-7` | `clamp(1.53125rem, .495536rem + 1.6183vw, 2.4375rem)` | `1.1` |
| `body-text-size-body` | `clamp(1rem, .714286rem + .446429vw, 1.25rem)` | `1.5` |
| `body-text-size-body-large` | `clamp(1.15625rem, .691964rem + .725446vw, 1.5625rem)` | `1.5` |
| `body-text-size-caption` | `.875rem` | `1.5` |

These are examples from the scale, not instructions to use campaign display sizes inside dense tables. Rem-to-pixel examples assume a 16px root and must not disable user font sizing.

PlanMirror deliberately uses a smaller bounded scale for its longer audit headline: hero `clamp(2.5rem, 5.2vw, 4.75rem)`, section heading `clamp(2rem, 3.3vw, 3.25rem)`, card heading `clamp(1.5rem, 2vw, 1.875rem)`, body 1rem/1.5 and caption .875rem/1.5. These are application choices, not copied PayPal scale names. Body stays readable at narrow widths; large headings use balanced wrapping.

The fallback heading stack is Century Gothic, Futura, Helvetica, Arial, sans-serif; body is Helvetica, Arial, sans-serif. Futura is an added local fallback, not the proprietary PayPal face. Font availability and synthesized weight prevent pixel-identical typography. No font was downloaded or hotlinked; exact font conformity remains unverified and would require an appropriately authorized font.

### Actions, navigation, shape and states

Theme root declares a large control height of 3rem, padding `.75rem 1.25rem`, text 1rem/24px at weight 700 and border width zero. Helpers use pill corners for supported button treatments; the earlier measured primary radius was 1000px. Large controls therefore naturally reach 48px at a 16px root. Small theme controls can be 2rem high; PlanMirror deliberately uses large actions for its navigation and CTA.

| Treatment, white plate | Rest | Hover | Pressed | Foreground |
| --- | --- | --- | --- | --- |
| Primary | `#000000` | `#333333` | `#4d4d4d` | White |
| Secondary | `#05378214` | `#05378227` | `#0537823a` | Black |
| Tertiary | Transparent | `#0537820a` | `#05378214` | Black |

These hover/pressed values are now confirmed by the theme, superseding their earlier status as approximations. PlanMirror uses a 200ms background/color transition, preserving the earlier measured timing. Keyboard focus is a separate 3px blue outline with a 4px offset, an application choice; never suppress it simply because the button has a hover state. On the light-blue workflow surface, PlanMirror overrides the focus outline with deep blue `#002991`: the white-plate focus blue is only 2.77:1 against light blue. Dark plate controls need the corresponding inverse colors rather than reusing black-on-black controls.

Use anchors for destinations and buttons for actions. Current navigation is in-page anchors; no nonfunctional dropdown chevrons or fake sign-in controls. The CTA now uses a directional arrow matching navigation, with its SVG hidden from assistive technology. Retain the chevron example above only for an actual expanding control or intentional downward navigation.

The theme's generic card and pricing-card radius is 1.5rem, but the inspected homepage hero token is zero. Rounded panels are common, not universal. PlanMirror uses 24px cards inside a full-width rectangular blue workflow surface; avoid giving every section a pill or floating shadow.

Disabled, busy, selected and error treatments have not been comprehensively established by this inspection. For future controls: use native disabled semantics; expose busy state and readable progress; make selected filters programmatically determinable; associate errors with inputs. Do not label invented disabled/error colors as PayPal values.

### Layout, spacing and responsive behavior

The helper stylesheet declares an initial four-inner-column grid and fluid gaps from 1rem to 2rem, plus several fluid spacing ranges. Other grid configurations and breakpoints appear in marketing components; there is no evidence that a fixed 12-column application dashboard is a universal PayPal mandate.

PlanMirror's explicit application layout:

- Container maximum 76rem, with 24px side gutters normally and 16px on narrow screens.
- Header at least 6rem high, brand left and working navigation right; wraps naturally at 36rem and below.
- Centered editorial hero with bounded heading/copy, a single black CTA, and a development/sandbox note. Vertical hero spacing is fluid from 4rem to 7rem.
- Broad light-blue workflow section, left-aligned section hierarchy and three white cards. Card gap 1.5rem and padding 1.5–2rem.
- Three workflow columns become one at 48rem and below. Evidence principles use two columns above that boundary and one below. Footer stacks at 36rem.
- Section spacing is fluid, headings can wrap, and no fixed card heights clip text. Do not import marketing hero `100vh` effects into audit screens.

These dimensions and breakpoints are independent adaptations. The original Safari layout sequence (header, centered lead, campaign media, editorial benefits, grouped features, utility/footer) is retained above as prior context. PlanMirror adopts the hierarchy and spacing without copying PayPal's campaign photography, product claims or complex scroll animation.

### Forms, audit data and AG Studio handoff

No form controls or AG Studio are added in this visual update. Their exact PayPal field geometry was not established, so these are **PlanMirror implementation requirements**, not verified PayPal specifications:

- Persistent labels, clear helper text, visible control boundaries and inline errors tied through `aria-describedby`; placeholders are supplementary.
- Never embed audit gate tokens or provider secrets into the client to make a form appear functional.
- Neutral canvas/cards and black typography should carry the data. Blue denotes brand, focus or navigation; it must not also imply a successful audit.
- Status badges must include explicit `match`, `mismatch` or `needs_review` wording. Select status colors independently, measure contrast and pair with text; do not invent a PayPal status palette.
- Distinguish run failure from a billing mismatch. Keep quote, source URL, plan ID, field path and retrieval timestamp near the selected finding; review rows may lack some evidence.
- Tables should preserve header associations, allow contained horizontal scrolling, wrap quotes and avoid truncating the only accessible evidence. Use tabular numerals for amount columns; preserve exact decimal strings and currency/cadence.
- Apply the same local font, white/black surfaces, 24px outer card radius and focus accents through supported AG Studio theme APIs. Keep filter controls close to findings; reserve display typography for page/section headings, not every grid cell.
- Keep sample versus actual sandbox labeling persistent; an agent answer should cite the same evidence as its selected finding.

### Accessibility and motion

The implementation adds a skip link, named navigation landmark, top-level header/footer landmarks, one H1, sequential headings, semantic ordered steps and working anchor destinations. All current navigation/action links and the wordmark have a minimum 48px height; the skip link uses explicit padding. A shared focus rule covers future native controls, too.

Validate normal text at least 4.5:1 and large text at least 3:1; check meaningful UI boundaries/focus at 3:1 against adjacent colors. These numeric acceptance targets are PlanMirror's WCAG-oriented QA choices, not measurements of PayPal's conformance. Alpha text must be composited: `#000000a1` resolves differently on white and light blue. Do not put normal-size white text on the light-blue workflow fill.

Reduced-motion preference disables transitions and animation. The earlier no-entrance-motion baseline is superseded for Overview by the November 6 user-requested motion revision below; essential content remains available without animation and never starts transparent. Use browser zoom and text enlargement; preserve focus and visible text labels rather than relying on color or icons alone.

### Implementation and review checklist

The current implementation lives in `app/globals.css` (shared tokens/components) and `app/page.tsx` (header, hero, workflow and evidence principles). Sai owns merchant/audit presentation, Sebastian carries this language into the dashboard/agent, and Hozaif coordinates shared CSS and contracts.

Before claiming a release is visually verified:

- Run lint, typecheck and production build after the final edit.
- Inspect at 320, 375, 768, 1024 and 1440px; check reflow at 200% zoom and no page-level horizontal overflow.
- Tab through skip link, brand, navigation and CTA; verify visible focus and that every anchor reaches its labeled section.
- Check primary/secondary hover and pressed states and reduced motion.
- Measure text contrast on the actual composite backgrounds; retain explicit labels and development status.
- Compare in an available browser with the current public reference, recording viewport/variant. That manual comparison and screenshot QA were unavailable in this session and must not be claimed complete.

### Verification recorded for this update

- `npm run lint -- --max-warnings=0`: passed after using Next's `Link` for home navigation.
- `npm run typecheck`: passed; final production build also completed its TypeScript check.
- `npm run build`: passed. Next warned that an unrelated lockfile outside the repository was ignored; this change did not alter tracing configuration.
- `git diff --check`: passed.
- Parsed generated production HTML: one H1, English document language, and every in-page anchor has an existing destination.
- Calculated WCAG relative-luminance ratios after alpha compositing: muted text on white 6.48:1, muted text on light blue 5.17:1, white on primary black 21:1, focus blue on white 4.98:1. The light-blue-surface focus override avoids the original 2.77:1 combination.
- No screenshot, viewport/reflow, interactive keyboard or computed-style browser checks were possible because the browser host was unavailable. No live API checks or deployment were performed for this presentation-only update.

## Findings tables and on-demand filters — November 5, 2026

This extends the PayPal-inspired visual system with established data-table interaction patterns. These table dimensions and interactions are **PlanMirror choices**, not undocumented PayPal requirements.

### Research references and decisions

- [Carbon data-table guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) place search, filtering, actions and settings in the table toolbar. They offer several densities, including a 48px large row/header option. We adopt the toolbar organization and consistent density; we do not import Carbon's brand styling or claim PayPal uses Carbon.
- [AG Studio modes and layout](https://www.ag-grid.com/studio/react/modes-layout/) documents separate view/edit panel configuration. PlanMirror explicitly disables the built-in left/right panels in view mode and supplies its own on-demand filter controls. This removes the sidebar through the supported API, rather than hiding SDK DOM with CSS.
- [AG Studio theming](https://www.ag-grid.com/studio/react/theming/) is the implementation reference for SDK styling. Confirm parameters against the installed version's exported types; use supported theme values rather than broad `.ag-*` overrides.

### Table appearance

The table should read as a calm, aligned set of evidence records, not a stack of boxed cells. Use white rows with a faint alternating wash, a lightly tinted header, fine horizontal rules and no prominent vertical grid. Use a restrained blue hover treatment without making hover the only indicator of selection. A readable status label accompanies any colored status badge.

Target 48px header/body rows, 14px body text, 13px bold headers and 14–16px horizontal cell padding. These are application density targets; allow wrapped content and contained horizontal scrolling when needed rather than shrinking text to fit. Use tabular numerals for displayed billing amounts and preserve currency/cadence labels. Keep the five visible columns focused on Inspect, field, status, advertised and configured values; summaries, quotes and long identifiers belong in the evidence detail. Complete values remain available through the accessible records view and evidence export.

Inspect is a compact row action, not a primary page CTA: about 30px high on desktop, with a 44px target for coarse pointers. Keep visible keyboard focus. Apply the same neutral header, spacing, row borders, status treatment and hover vocabulary to the accessible HTML table. Styling must not remove native table header relationships or replace values with color alone.

### Filter interaction

Use a single **Filters** button in the findings toolbar. It reports the number of active status/field filters and opens a compact disclosure above the table. This is not a permanent sidebar and does not reserve horizontal canvas space when closed. The panel contains labeled status/field controls plus reset and close actions. Status-count tiles remain shortcuts into the same filter state.

The button exposes `aria-expanded` and `aria-controls`; closed contents are hidden and not keyboard-focusable. Escape closes an open panel and returns focus to its trigger. Keep active scope readable when the panel is closed, and retain zero-result recovery. Filters apply to both grid and accessible records; export remains all findings in the selected run. Changing scenario resets filter state and selection must stay tied to a visible finding.

Markdown must retain the active scope, complete visible evidence and run issues even when the filter disclosure is closed; a hidden control panel is not the source of truth for the snapshot. Do not enable an independent SDK filter sidebar alongside the application filters, because it would introduce competing scope and counts.

### Verification boundary

Check the filter button's expanded/control relationship, hidden panel semantics, clear/reset behavior, selection after filtering, and keyboard close/focus return. Check table overflow, headers, row height, status text and compact actions in the running browser when available. A build and theme typecheck verify integration syntax, not final rendered appearance or keyboard behavior.

### Current Studio layout override

At Sebastian’s request, findings span the full page content width, with evidence beneath rather than beside the table. Advertised/configured evidence is side by side on wider screens and stacks at 640px and below. This supersedes the earlier split-workspace arrangement.

### Transparent brand variants

The original PNGs contain an off-white background despite their PNG format. The header/footer now use `planmirror-logo-transparent.png` and `planmirror-wordmark-transparent.png`, generated with the built-in image editor using background-extraction prompts. The original PNGs are retained. Verified RGBA output includes fully transparent pixels; these are generated cutouts, not guaranteed pixel-identical edits. The wordmark display uses centered cover framing at its prior display size to compensate for added canvas padding.

## Overview motion revision — November 6, 2026

Sebastian requested animation on Overview using PayPal's existing design language. Rechecked the [PayPal US homepage](https://www.paypal.com/us/home) and [Pentagram's PayPal identity case study](https://www.pentagram.com/work/paypal/story). The latter describes a black/white foundation, blue accents and motion based on everyday payment gestures. The previously recorded hosted theme/hero CSS URLs could not be retrieved through the web tool in this check, so their earlier values were not independently reverified. This update uses the existing local tokens and independent CSS; exact durations/easing are PlanMirror choices, not claimed PayPal specifications.

Overview now includes a semantic, explicitly fictional advertised-versus-configured comparison: 30 versus 7 free days and USD 19 versus USD 24 monthly. Its caption explains the illustrative differences and that no live audit has run. All values and context are ordinary HTML and included in the agent snapshot without interaction; the connecting arrow is decorative. This does not run or replace the comparison engine.

Motion consists of short vertical text arrivals, two inward card slides with slight rotation, CTA arrow feedback/press response and pointer-hover workflow-card lift. Every animation is finite (at most 850 ms, ending within 1.1 seconds including delay), runs only with `prefers-reduced-motion: no-preference`, and changes transforms rather than hiding text. There is no scroll/JavaScript dependency, autoplay loop or essential animated-only meaning. Reduced-motion users receive the complete static page. The preview stacks on narrow screens, retaining the existing responsive shell and footer robot.

# PayPal design reference for PlanMirror

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

Crystalline owns the page styling. Sebastian should coordinate dashboard surfaces and heading hierarchy with these tokens.

- Use the local Century Gothic / Helvetica / Arial fallback stack.
- Use fluid hero typography with weight 900, line height 1.1, and letter spacing -0.03em.
- Match the inspected primary action’s padding, radius, text size, and black-and-white contrast.
- Keep the workflow visually distinct with a pale blue surface and white cards.
- Keep keyboard focus visible and permit touch controls at least 44px high.
- Stack the workflow cards on small screens and keep the hero readable at narrow widths.
- Retain PlanMirror branding and subscription-audit wording.

The pale blue workflow fill, responsive breakpoints, focus treatment, and card layout are PlanMirror choices. PayPal’s proprietary font files were not imported. Font appearance will depend on which fallback is available locally.

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

The computed heading and primary-action values above were read from the public page in the previous inspection. The current scaffold implements black foreground, white primary surfaces, a blue accent, gray labels, and a pale blue workflow panel. The exact PlanMirror colors are centralized in the CSS theme.

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

Crystalline can extend the header, hero, spacing, and responsive interface. Sebastian can carry the same colors, heading scale, and control shapes into AG Studio. Hozaif coordinates shared CSS changes. The reference captures visible design patterns and sampled computed values. It contains original implementation examples rather than a source archive.

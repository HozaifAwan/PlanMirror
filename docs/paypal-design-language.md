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

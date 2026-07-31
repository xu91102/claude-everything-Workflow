# UI Prototype

Build a runnable in-project UI prototype. Use `skills/visual-companion/SKILL.md` only when its secured
browser companion materially improves review; its consent and authentication contract remains binding.

## Variants

- Default to three and cap at five.
- Make variants structurally different: layout, information hierarchy and primary affordance, not
  only color or copy.
- Prefer embedding variants in an existing page with real read-only data, params, authentication shell
  and realistic density. Swap only the rendered subtree.
- Create a visibly throwaway route only when no existing surface can host the question.
- Select variants with a `?variant=` search parameter so each view is shareable and reload-stable.
- Use the project's existing component and styling system.

## Interaction

Provide a clearly non-production switcher that:

- identifies the current variant;
- moves forward/back with controls and arrow keys;
- does not intercept keys inside editable elements;
- is gated out of production builds.

Expose one existing project run command and the exact URLs for all variants. Do not start a local
server or open the browser without the active task's authorization/consent.

After a choice, record which variant won and why. Rewrite the winner under normal production gates;
remove the switcher and losing variants from the production path.

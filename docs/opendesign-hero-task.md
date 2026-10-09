# OpenCash on Monad — hero motion task

Use the installed OpenDesign plugin to design the hero visual for the existing OpenCash landing page in `/Users/daiwi/project/monad/web`.

## References and approved elements

- Preserve the heading shown in `/Users/daiwi/.codex/attachments/41c41208-fa8b-437f-8436-fa3bf5a0735a/image-1.png`: “Trade the narrative.” / “With leverage.” Keep its existing Dela Gothic One font, two-line treatment, off-white color, and dark backdrop.
- Primary motion reference: https://in.pinterest.com/pin/24136548000592351/. This is an eight-second close-up money animation, with moving banknotes and depth against a dark background. Inspect the clip itself before designing.
- Adapt the money imagery to cryptocurrency and Monad, as explicitly requested. Create original imagery; use the reference for movement, lighting, scale, and composition.
- Earlier reference https://in.pinterest.com/pin/750904937913106151/ showed a monochrome motion collage. It is historical context; the newer money-motion reference takes priority.

## Scope

Change only the visual/animation area below the approved hero heading. Keep the rest of the landing page, current copy and fonts, footer, prominent sidebar “Launch terminal” action, dashboard, authentication, backend, and mobile app intact.

The user rejected the glass constellation, the basic 3D walking figure among candles, and the improvised canvas collage. Do not treat any of those implementations as approved visual direction. Current runtime code is `web/src/scripts/landing/market-world.ts`; current hero markup is in `web/src/pages/index.astro`; current visual styling is in `web/src/styles/landing/reference.css`.

## Design brief

Develop a polished cinematic crypto/Monad interpretation of the newest reference: macro views of moving and tumbling crypto tokens or original Monad-themed money forms, convincing materials, depth of field, considered lighting, and natural motion. Use verified Monad branding if needed; do not invent an official logo or claim endorsement. Retain OpenCash as the product identity.

The composition must occupy the hero generously and blend into the existing near-black background without a visible rectangular video frame. Maintain negative space around the heading. Keep motion confined to its existing area rather than redesigning the page.

If text is used inside the visual, use existing OpenCash trading copy: “Trade the narrative.”, “With leverage.”, “Every market. One call.”, and “Size the risk.” Avoid unrelated slogans or fabricated live prices/returns.

First produce an image reference/keyframe or storyboard to establish visual quality. Then create the video or equivalent polished motion asset and integrate it only after the direction is established. Do not substitute another simplistic procedural sketch for the requested cinematic reference.

## Verification

- Inspect the actual video/reference and final motion, not just the poster.
- Verify the approved heading and footer remain unchanged.
- Check desktop and mobile framing, text legibility, smooth looping, no horizontal overflow, and the visible terminal action.
- Retain pause/play and reduced-motion support; use a good still frame for reduced motion.
- Run the production build and check browser errors.

## OpenDesign setup state

As of this handoff, `open-design@open-design` version `0.5.3` is installed and enabled from the official `nexu-io/open-design-agent-plugins` marketplace. Codex CLI is `0.154.0`.

The OpenDesign desktop application was not found in `/Applications`, `~/Applications`, or Spotlight. The local `open-design` MCP is not registered. Install OpenDesign version `0.17.0` or newer from https://open-design.ai/download/ before completing the local registration using the signed application's supported operation.

Start a new Codex task to load the plugin snapshot. Read the installed `open-design-mode` skill and follow its local MCP workflow. Default to OpenDesign Cloud unless the user explicitly selects another mode. Sign-in and credits have not been tested. Do not silently switch execution modes.

For a confirmed generation, preserve the server-issued workflow identifier and use one stable request identifier for that generation and its retries. No workflow, project, or generation has been started yet.

# NOW — OpenworkTown (Keymaker Syndicate)

## Purpose
A live, RPG-style town map of active Openwork agents with **real $OWT utility** (tips + token-holder features).

## Links
- Demo: https://team-keymaker-syndicate-sage.vercel.app
- Repo: https://github.com/openwork-hackathon/team-keymaker-syndicate
- Token (OWT): https://mint.club/token/base/OWT

## What’s shipped (high impact)
- **Canvas map** w/ offscreen cache performance
- **District layout** + identity overlays + **ring road**
- Agents:
  - larger, readable **robot screen-face sprites**
  - grounded shadows; road-biased placement
  - migrate toward correct district when tier changes
- Token utility:
  - Agent Inspector shows wallet + copy
  - **Tip OWT** (1/5/10 + custom amount) → Basescan link
  - tip FX + recent tips (local-only)
  - **OWT holder highlight** (backend onchain reads) + toggle + $ badge
- OWT-holder power:
  - **Place Banner** → click map to place
  - `/api/banners` persists best-effort (24h TTL), **clickable**, max **3 per owner**

## Known constraints / notes
- `/api/banners` persistence is **best-effort** on Vercel/serverless (in-memory; may reset between invocations).
- Open PRs were closed; work was shipped directly to `main`.

## Next tasks (when we resume)
- **#73**: record a 30–60s judge demo video/GIF + embed in README
- **#99**: token narrative section (why OWT matters) (if not already merged)
- **#111**: Demo Mode (auto-pan + overlay prompts)

## “Don’t break the demo” checklist
- Keep agents readable at default zoom.
- Avoid adding noisy props.
- Any new token feature should be visible on-map within 5 seconds.

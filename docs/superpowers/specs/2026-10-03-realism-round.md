# Realism round (branch `realism`, not live)

Goal: make street, stairwell and roof feel real while the site still starts within ~3 s on 4G (heavy assets load while the visitor is outside).

## References (in media/inbox, inspiration only; the two stock images are watermarked: never use as textures)
- **Street:** `AmsterdamHoofddorpplein02.jpeg`, the real Hoofddorpplein corner (Amsterdam School): warm red-brown brick, white window frames, shopfronts at street level, trees, bikes, crosswalk. The facade should read as this building at night.
- **Stairwell:** neon-stairs stock photo: vertical pink neon tubes along the banisters, blue haze/fog, glowing panels at the top. More depth and haze; pink neon against a cool contrast colour.
- **Roof:** rooftop-party stock photo: crowd, lit bar, purple light, glass railing, dense skyline of lit windows at blue hour.

## Approach
- Model + light in Blender (Blender MCP; Poly Haven CC0 textures/models), bake lighting into textures, export compressed .glb (Draco/meshopt, KTX2 textures), load in three.js.
- Street first (it's the first impression), then stairwell, then roof.
- Budget: initial JS + street .glb ≈ ≤ 2.5 MB; stairwell/roof stream in behind it.
- Review via a private preview link (scripts/preview-artifact.sh); merge to main only on the user's go.

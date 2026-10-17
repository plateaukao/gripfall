# Grip / Fall — Stunt Arena

A playable HTML car-stunt game with a cinematic arena, vacuum grip, and powered landings.

**[Play Grip / Fall](https://plateaukao.github.io/gripfall/)**

Open `index.html` directly in a browser. No packages, server, build, or network connection are needed. Click **Watch demo** for a successful return, or drive with **Space + ↑**. During a demo, illuminated buttons show the real commands being used, including lift, steering, and automatic pitch jets; they clear at the end of the run.

## Controls

| Control | Action |
| --- | --- |
| Space (hold) | Drive forward along the ground and ramp |
| ↑ (hold) | Apply vacuum throttle; release to wind suction down |
| ↓ (hold) | Fire exhaust downward to lift the car and slow its fall |
| ← / → | Left / right landing thrust |
| W (optional) | Downward force to descend faster |
| A / D | Front / rear lift jets to adjust pitch |
| Level assist | Toggle automatic pitch correction |
| R | Retry |

There is no wheel-brake control or Q/E vacuum adjustment. The drive and vacuum buttons support simultaneous touch. Up Arrow applies suction toward the ramp and never fires landing jets. Vacuum does not provide lift in open air. Down Arrow fires exhaust downward, producing upward lift. All four landing jets remain independently controllable.

## Reference proportions

The previous circular ramp has been replaced with a profile traced in proportion from the supplied images: a short foot, a tall nearly upright middle, then a long upper sweep leaning back toward the starting side. Two continuous cubic sections define the actual road. The renderer and physics both use their sampled arc length, tangent and curvature, so the car follows the visible shape and launches back toward the start.

The ramp is 66 game meters high, rises from a foot at x=112, reaches its rightmost centerline at x=117, and sweeps left to a lip at x=92. The landing zone is centered at x=18: its distance from the foot is about 1.42 ramp heights. These are visual proportions inferred from the reference, not measurements of a real structure.

Vacuum adds surface adhesion and wheel traction. Jets and automatic pitch correction consume fuel. Landing requires both wheels inside the lit zone, body angle within 15 degrees, vertical speed at most 4.2 m/s, and horizontal speed at most 5.2 m/s. Hard or body-first impacts end the run.

The game uses arcade physics in one vertical plane with a cinematic road rendered with depth.

## Verification

Run `node check.cjs` for the dependency-free physics checks: narrow reference profile, distant landing proportions, reversed launch, successful landing, hard impacts, insufficient grip, vacuum throttle release, all four jets, pitch control, and empty fuel.

Chrome checks cover Space driving even after clicking Retry, hold/release ↑ suction, ↓ lift, independent directional jets, pitch jets, a complete return landing, help, simultaneous touch controls, and a 390px viewport.

## GitHub Pages

The game is published from the root of the `main` branch at https://plateaukao.github.io/gripfall/. Push changes to `main` to update the live game. `.nojekyll` serves the static files directly.

The original local reference images, design studies, screenshots, and notes are ignored by Git.

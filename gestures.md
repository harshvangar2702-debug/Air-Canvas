# Gesture Specification — AirInk

All thresholds are starting values; tune empirically. Distances are normalized
by hand size (wrist → middle-finger MCP).

| Gesture | Trigger | Action | Notes |
|---------|---------|--------|-------|
| Pinch (draw) | pinchDist enter < 0.35, exit > 0.5 | Draw stroke | Hysteresis; 2-frame debounce |
| Grab (move) | all four finger curls < 0.7 (fist), not pinching | Select & move nearest stroke | Palm faces camera |
| Erase | index+middle pinch, then shake (2 direction reversals < 400ms) | Delete stroke under cursor | Deliberate to avoid accidents |
| Idle | none of the above | Show cursor only | Neutral pose safe |

## Landmark index reference (MediaPipe Hands)
- 0 wrist
- 4 thumb tip
- 8 index tip
- 12 middle tip, 9 middle MCP (hand-size anchor)
- 16 ring tip, 20 pinky tip

## Anti-flicker rules
- Two thresholds per gesture (enter/exit).
- Require state to hold N frames before committing.
- Always smooth landmarks (One Euro) before computing metrics.

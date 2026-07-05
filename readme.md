# AirInk ✋🎨

Draw in 3D mid-air using only your laptop webcam and hand gestures.
Pinch to draw, grab to move, and orbit to see your creation float in space.

## Stack
TypeScript · Vite · MediaPipe Tasks (Hand Landmarker) · Three.js · Rapier (WASM)

## Requirements
- Modern Chrome/Edge (WebGL2 + WASM)
- A webcam
- Node 18+

## Setup
```bash
npm install
npm run dev
Open the printed localhost URL and allow camera access.

Controls
Pinch (thumb + index): draw a stroke
Fist / grab: move the nearest stroke
Deliberate erase gesture: delete a stroke
Mouse drag / scroll: orbit & zoom the camera
HUD: color, thickness, physics toggle, reset, export
Privacy
All processing is local. No video ever leaves your device.

Known limitations (v1)
A single webcam cannot measure true depth; v1 draws on a fixed-depth plane and gets its 3D feel from rendering + camera orbit.
Gestures work best with the palm facing the camera.
Copy
---

## `CLAUDE.md`  (project rules Claude Code auto-reads)

```markdown
# CLAUDE.md — Working agreement for AirInk

## Read first
Read PRD.md, DESIGN.md, GESTURES.md, and ROADMAP.md before writing code.

## Principles
- Build strictly milestone-by-milestone per ROADMAP.md. Do NOT skip ahead.
- After each milestone, ensure `npm run dev` runs with no console errors and
  STOP for me to verify before continuing.
- Keep the all-browser TypeScript stack. No Python unless I explicitly ask.
- Small, focused modules matching the file layout in DESIGN.md §3.
- Prefer clarity over cleverness. Comment the non-obvious math (coord mapping,
  gesture metrics, One Euro filter).

## Constraints
- Do NOT assume real depth from the webcam. Use the fixed drawing plane (v1).
- All gesture detection MUST use hysteresis + smoothing to avoid flicker.
- Dispose Three.js geometries/materials you no longer use.
- Handle camera-permission-denied gracefully.

## Definition of done (per milestone)
- Runs locally, no errors.
- Behavior matches the milestone description.
- Brief note in commit message: which milestone + what to test manually.

## Tech pins
- three, @mediapipe/tasks-vision, @dimforge/rapier3d-compat, vite, typescript.
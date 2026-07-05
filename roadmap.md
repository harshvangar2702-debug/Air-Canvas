# Build Roadmap — AirInk (incremental milestones)

Build and verify each milestone before moving on. Each should run.

## M0 — Project scaffold
Vite + TypeScript + Three.js. Blank rotating cube. `npm run dev` works.

## M1 — Webcam + landmarks
MediaPipe HandLandmarker on webcam. Draw 21 landmarks on a debug canvas overlay.

## M2 — Smoothing + metrics
One Euro Filter. Compute pinchDist, curls, handSize. Log values live.

## M3 — Gesture FSM
Pinch detection with hysteresis. On-screen text shows current state. No flicker.

## M4 — First stroke (WOW milestone)
Pinch draws a 3D tube on the fixed drawing plane. Release finalizes it.

## M5 — Persistence + orbit
Finalized strokes stay. OrbitControls let user circle the drawing → proves 3D.

## M6 — Grab to move
Grab selects nearest stroke and moves it; release drops it.

## M7 — Physics
Rapier integration. Toggle gravity → strokes fall/bounce. Reset restores.

## M8 — Polish
Color/thickness HUD, cursor feedback, deliberate erase, export GLTF.

## M9 — Stretch (optional)
Depth from hand-size proxy or push/pull gesture; monocular depth model; SLAM.

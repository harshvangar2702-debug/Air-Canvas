# Technical Design — AirInk

## 1. Architecture (All-Browser)
Single-page web app. No backend required for v1.

Webcam ──► MediaPipe Tasks (Hand Landmarker, WASM) │ landmarks (21 pts, normalized) ▼ One Euro Filter (smoothing) │ ▼ Gesture FSM (pinch / grab / open / idle) │ events + cursor position ▼ ┌────────────┴───────────────┐ ▼ ▼ StrokeManager InteractionManager (build/finalize meshes) (pick, move, erase) │ │ └──────────┬─────────────────┘ ▼ Three.js Scene ◄──► Rapier Physics (WASM) ▼ WebGL2 render loop

Copy
### Alternative (Hybrid, optional)
Python (OpenCV + MediaPipe) → WebSocket (JSON landmarks @30Hz) → same
browser frontend. Only choose this if Python CV is a hard requirement.

## 2. Tech Stack
- Language: TypeScript
- Bundler/dev server: Vite
- Hand tracking: `@mediapipe/tasks-vision` (HandLandmarker)
- Rendering: `three`
- Physics: `@dimforge/rapier3d-compat` (WASM)
- Smoothing: custom One Euro Filter (small module)
- No framework needed (vanilla TS + Three.js), or add Vite + minimal DOM UI.

## 3. Module Breakdown
- `src/vision/handTracker.ts` — init camera, run HandLandmarker, emit landmarks.
- `src/vision/oneEuro.ts` — One Euro Filter (per-coordinate).
- `src/gestures/gestureFSM.ts` — classify pinch/grab/open with hysteresis.
- `src/gestures/metrics.ts` — normalized pinch distance, curl, hand size.
- `src/scene/sceneManager.ts` — Three.js scene, camera, lights, OrbitControls.
- `src/scene/strokeManager.ts` — live stroke buffer → TubeGeometry meshes.
- `src/scene/cursor.ts` — 3D cursor + pinch/hover visual feedback.
- `src/interaction/interactionManager.ts` — grab-pick-move, erase.
- `src/physics/physicsWorld.ts` — Rapier world, colliders, gravity toggle.
- `src/ui/hud.ts` — color/thickness picker, physics toggle, status.
- `src/main.ts` — wire everything, run loop.

## 4. Coordinate Mapping
1. MediaPipe gives normalized (x∈[0,1], y∈[0,1], z relative).
2. Mirror x (selfie view): `x = 1 - x`.
3. Map to a drawing plane in world space at fixed depth `Z_PLANE`:
   - `worldX = (x - 0.5) * PLANE_WIDTH`
   - `worldY = (0.5 - y) * PLANE_HEIGHT`
   - `worldZ = Z_PLANE` (constant in v1)
4. (Optional F11) Modulate `worldZ` from hand-size proxy or push/pull gesture.

## 5. Gesture Detection
### Metrics (all normalized by hand size = wrist↔middle-MCP distance)
- `pinchDist` = |thumbTip − indexTip| / handSize
- `curl_i` = |fingerTip_i − palmBase| / handSize for each finger

### FSM states: IDLE, DRAWING, GRABBING, ERASING
- Enter DRAWING when `pinchDist < T_PINCH_LOW` for ≥ 2 frames.
- Exit DRAWING when `pinchDist > T_PINCH_HIGH`.
- Enter GRABBING when all `curl_i < T_CURL` (fist), not pinching.
- ERASING: deliberate gesture (e.g., two-finger pinch + shake) — NOT open palm.
- Hysteresis (T_LOW < T_HIGH) + N-frame debounce prevents chatter.

## 6. Stroke Rendering
- While DRAWING: append smoothed cursor point to active point buffer if it moved
  > MIN_SEGMENT_DIST. Rebuild a lightweight preview (line) each frame.
- On finalize: build a `TubeGeometry` along a `CatmullRomCurve3` through points;
  add as a persistent `Mesh`. Assign current color/thickness.
- Store metadata: id, points, color, radius, physicsEnabled.

## 7. Physics
- Rapier world, gravity default OFF (strokes stay where drawn).
- Toggle ON: create a compound/capsule collider approximating each stroke;
  create a dynamic rigid body; on each frame sync mesh transform to body.
- "Reset" restores strokes to their drawn positions (store original transforms).

## 8. Interaction (Grab & Move)
- On GRAB start: find nearest finalized stroke to cursor within RADIUS; select.
- While GRAB: translate selected stroke by cursor delta.
- On GRAB end: release; if physics on, re-enable body.

## 9. Performance
- Cap MediaPipe to 1 hand, `runningMode: VIDEO`.
- Reuse geometries/materials; dispose finalized preview lines.
- Decouple: vision at camera FPS, render via `requestAnimationFrame`.
- Throttle stroke point sampling to avoid huge geometries.

## 10. Error Handling
- No camera / denied permission → friendly overlay with retry.
- WASM load failure → fallback message.
- Lost hand → freeze cursor, do not spawn stray points.
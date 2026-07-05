# Product Requirements Document — AirInk

## 1. Overview
AirInk is a spatial drawing application that lets users create and interact with
3D drawings in the air using only a laptop webcam and hand gestures. Strokes are
placed into a persistent 3D scene and remain anchored after the hand moves away,
creating the illusion of drawing in mid-air.

## 2. Goals
- Draw 3D strokes in the air using pinch gestures tracked by a webcam.
- Persist strokes in a 3D scene the user can orbit around.
- Manipulate strokes (move) with a grab gesture.
- Optionally apply physics (gravity, collisions, bouncing).
- Run entirely in the browser with no special hardware.

## 3. Non-Goals (v1)
- True metric depth / real-world scale (mono webcam cannot measure this reliably).
- Multi-user / collaborative drawing.
- Mobile phone support (desktop/laptop browser only for v1).
- VR/AR headset support.
- Saving/loading to a cloud backend (local export only).

## 4. Target Users
Makers, students, and creative technologists exploring spatial computing on
everyday laptops.

## 5. Key Constraints & Assumptions
- Input is a single RGB webcam. **No true depth is available.**
- MediaPipe's per-landmark `z` is relative and noisy — used only as a soft hint.
- v1 draws on a fixed-depth virtual plane; 3D perception comes from rendering +
  camera orbit, not from measured input depth.
- Target latency: end-to-end hand-to-stroke < 100 ms.
- Target frame rate: 30–60 FPS.

## 6. Functional Requirements
| ID  | Requirement | Priority |
|-----|-------------|----------|
| F1  | Capture webcam feed and detect one hand in real time | Must |
| F2  | Detect pinch gesture with hysteresis (no flicker) | Must |
| F3  | On pinch, draw a continuous 3D stroke on the drawing plane | Must |
| F4  | On pinch release, finalize stroke as a persistent scene object | Must |
| F5  | Orbit/zoom the camera to view drawings from any angle | Must |
| F6  | Detect grab gesture to select & move the nearest stroke | Should |
| F7  | Toggle physics (gravity/collisions) on strokes | Should |
| F8  | Erase via a deliberate gesture (not resting open palm) | Should |
| F9  | Color & brush-thickness selection | Could |
| F10 | Export scene (GLTF/JSON) | Could |
| F11 | Depth control via secondary gesture (push/pull) | Could |

## 7. Non-Functional Requirements
- Runs in Chrome/Edge (WebGL2 + getUserMedia + WASM).
- Graceful failure if no camera / permission denied.
- No stroke flicker; smoothed cursor with < 1 frame perceptible lag.
- All processing local; no video leaves the device.

## 8. Success Metrics
- A first-time user can draw a recognizable shape within 60 seconds.
- Pinch detection false-trigger rate < 5% during normal drawing.
- Sustained ≥ 30 FPS on a mid-range 2020+ laptop.

## 9. Risks
| Risk | Mitigation |
|------|------------|
| Mono depth ambiguity | Fixed drawing plane in v1; document clearly |
| Gesture flicker | Hysteresis FSM + One Euro filter |
| Open-palm accidental erase | Use deliberate erase gesture + confirmation |
| Arm fatigue ("gorilla arm") | Short interactions, strong visual feedback |
| Hand occlusion (edge-on) | Design gestures keeping palm facing camera |

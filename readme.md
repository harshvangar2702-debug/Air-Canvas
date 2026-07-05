# AirCanvas

Draw in 3D mid-air using nothing but your laptop webcam and hand gestures.
Pinch to draw, fist to grab and move, open palm to erase, orbit with two
hands to fly around your creation — all tracked locally, no video ever
leaves your device.

## Stack
TypeScript · Vite · MediaPipe Tasks Vision (Hand Landmarker) · Three.js · Rapier3D (WASM)

## Requirements
- Modern Chrome/Edge (WebGL2 + WASM)
- A webcam
- Node 18+

## Setup
```bash
npm install
npm run dev
```
Open the printed localhost URL and allow camera access.

## Controls

### Draw mode (default)
| Gesture | Action |
|---|---|
| Pinch (thumb + index) | Draw a stroke |
| Fist / grab | Move the nearest stroke |
| Open palm (while Eraser is toggled on) | Wipe strokes |
| `O` key | Switch to Orbit mode |

### Orbit mode (`O`)
| Gesture | Action |
|---|---|
| Two-hand pinch, move apart/together | Zoom |
| Two-hand pinch, twist | Rotate around the scene |
| One open palm | Rotate the view |
| Mouse drag / scroll | Orbit & zoom (always available) |

### Toolbar
- **Shape tools** — Freeform, Line, Rectangle, Square, Circle, Ellipse, Triangle, Arrow.
  Pick a shape tool and your stroke snaps to the ideal form on release; Freeform keeps the raw path.
- **Pen styles** — Solid, Glow, Marker, Calligraphy (tapered), Dashed.
- **Colors & thickness** — swatch palette, S/M/L stroke width.
- **Eraser** — toggle on, then open-palm wipe removes strokes near your hand.
- **Gravity** — drop physics on/off for drawn strokes (Rapier3D).
- **Clear** — wipes the canvas.
- **Export GLTF** — downloads the scene as a `.gltf` file.

## Privacy
All hand tracking and rendering happens locally in the browser. No video or
landmark data is ever sent anywhere.

## Known limitations (v1)
- A single webcam cannot measure true depth — AirCanvas draws on a fixed-depth
  plane and gets its 3D feel from rendering, physics, and camera orbit, not
  measured hand distance.
- Gestures work best with the palm facing the camera and reasonable, even lighting.

## Project docs
See `PRD.md`, `DESIGN.md`, `GESTURES.md`, and `ROADMAP.md` for the product spec,
architecture, gesture design, and milestone history behind this build.

# AirCanvas

AirCanvas is a browser-based drawing experience that turns your webcam into a 3D sketching surface. Use hand gestures to draw, move, erase, and orbit around your scene without leaving the browser.

## Why it exists

This project explores natural interaction with computer graphics using computer vision. The goal is simple: make digital creation feel as immediate as drawing in the air.

## Features

- Mid-air 3D sketching with a laptop webcam
- Gesture-based drawing, grabbing, erasing, and scene navigation
- Shape snapping tools for cleaner geometry
- Multiple pen styles, colors, and stroke widths
- Physics-enabled strokes with optional gravity
- GLTF export for sharing or further editing
- Fully local processing for privacy

## Tech stack

- TypeScript
- Vite
- Three.js
- MediaPipe Tasks Vision
- Rapier3D (WASM)

## Requirements

- A modern Chromium browser with WebGL2 support
- A working webcam
- Node.js 18 or newer

## Getting started

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser and allow camera access.

## Controls

### Draw mode

| Gesture | Action |
|---|---|
| Pinch with thumb and index | Draw a stroke |
| Fist or grab gesture | Move the closest stroke |
| Open palm while eraser is enabled | Erase nearby strokes |
| O key | Switch to orbit mode |

### Orbit mode

| Gesture | Action |
|---|---|
| Two-hand pinch, move apart or together | Zoom |
| Two-hand pinch, twist | Rotate around the scene |
| One open palm | Rotate the view |
| Mouse drag and scroll | Orbit and zoom |

## Toolbar highlights

- Shape tools: freeform, line, rectangle, square, circle, ellipse, triangle, and arrow
- Pen styles: solid, glow, marker, calligraphy, and dashed
- Color and thickness controls
- Eraser toggle
- Gravity toggle for physics-based strokes
- Clear canvas and GLTF export actions

## Privacy

All hand tracking and rendering happen locally in the browser. No video or landmark data is sent to a remote service.

## Known limitations

- A single webcam does not provide true depth sensing, so the experience uses a fixed-depth plane with camera-based perspective for its 3D feel.
- Best results come from clear lighting and a visible palm facing the camera.

## Project docs

See PRD, design, gestures, and roadmap documents in the repository for the product spec, architecture notes, and milestone history.

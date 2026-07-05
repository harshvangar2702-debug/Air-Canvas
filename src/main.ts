import { SceneManager } from './scene/sceneManager';
import { HandTracker } from './vision/handTracker';
import { DebugOverlay } from './vision/debugOverlay';
import { LandmarkSmoother } from './vision/landmarkSmoother';
import { computeMetrics } from './gestures/metrics';
import { GestureFSM } from './gestures/gestureFSM';
import { cursorFromLandmarks, palmCenterFromLandmarks } from './scene/coords';
import { Cursor } from './scene/cursor';
import { StrokeManager } from './scene/strokeManager';
import { exportToGLTF } from './scene/exporter';
import { InteractionManager } from './interaction/interactionManager';
import { TwoHandNav } from './interaction/twoHandNav';
import { PalmOrbit } from './interaction/palmOrbit';
import { PhysicsWorld } from './physics/physicsWorld';
import type { DrawTool } from './scene/shapeFitter';
import type { PenStyle } from './scene/penStyles';
import { MetricsHud } from './ui/metricsHud';
import { ControlBar } from './ui/hud';
import { icon } from './ui/icons';
import { showErrorOverlay, describeCameraError } from './ui/errorOverlay';
import * as THREE from 'three';

/**
 * M8 entry point (polish): on top of M7 physics, adds HUD controls — color
 * swatches, brush thickness, and a GLTF export button — plus a cursor that
 * previews the active pen color. Eraser is palm-only (open-palm wipe). Earlier
 * milestones (draw / grab / orbit / physics) are unchanged.
 */
const container = document.getElementById('app');
if (!container) {
  throw new Error('#app container not found in index.html');
}
// The overlay canvas is absolutely positioned within #app.
container.style.position = 'relative';

const sceneManager = new SceneManager(container);

// Render loop (display rate). Independent of the vision loop (DESIGN §9).
// Started below, once the physics world it references has been created.
function animate() {
  requestAnimationFrame(animate);
  physics.step(); // no-op unless gravity is enabled; syncs stroke meshes to bodies
  sceneManager.render();
}

// --- Vision pipeline --------------------------------------------------------

const overlay = new DebugOverlay(container);
const metricsHud = new MetricsHud(container);
const cursor = new Cursor(sceneManager.scene);
const strokeManager = new StrokeManager(sceneManager.scene);
const interaction = new InteractionManager();
const twoHandNav = new TwoHandNav();
const palmOrbit = new PalmOrbit();
const physics = new PhysicsWorld();
// Load the Rapier WASM up front so the gravity toggle is ready when pressed.
void physics.init();
animate(); // physics now exists; safe to start the render loop
const tracker = new HandTracker();
// Show the mirrored webcam feed as the scene background so strokes appear over
// the user's real surroundings.
tracker.attachAsBackground(container);

// --- Mode toggle: Draw (AR) vs Orbit ---------------------------------------
// Two mutually exclusive modes (M5 design decision):
//  - DRAW: webcam background on, camera face-on, gestures draw strokes.
//  - ORBIT: webcam hidden, mouse drag/scroll circles the drawing to prove it's
//    3D; drawing is paused so a stray pinch doesn't scribble while orbiting.
// Press 'O' to toggle. This keeps the fixed-plane drawing math valid (it only
// holds face-on) while still letting the user inspect depth.
let orbitMode = false;

// Bottom-center mode notice: a glass card matching the toolbar, with an icon
// chip, the current mode + gestures, and a clear "O" key badge to toggle modes.
const UI_FONT = "13px/1.4 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const hint = document.createElement('div');
Object.assign(hint.style, {
  position: 'absolute',
  bottom: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 16px 10px 12px',
  font: UI_FONT,
  color: '#e6e9ef',
  background: 'rgba(17, 20, 28, 0.72)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '14px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
  backdropFilter: 'blur(12px)',
  maxWidth: 'min(720px, calc(100% - 24px))',
  pointerEvents: 'none',
  zIndex: '5',
});
container.appendChild(hint);

// A key badge (styled <kbd>) and an accent-tinted icon chip.
function keyBadge(label: string): string {
  return (
    `<kbd style="display:inline-flex;align-items:center;justify-content:center;` +
    `min-width:22px;height:22px;padding:0 6px;margin:0 2px;border-radius:7px;` +
    `border:1px solid rgba(255,255,255,0.30);border-bottom-width:2px;` +
    `background:rgba(255,255,255,0.12);font:600 12px/1 ui-monospace,monospace;` +
    `vertical-align:middle">${label}</kbd>`
  );
}

function setOrbitMode(on: boolean) {
  orbitMode = on;
  sceneManager.setOrbitEnabled(on);
  sceneManager.setGridVisible(on); // grid gives spatial context while orbiting
  tracker.setBackgroundVisible(!on);
  // Overlay stays visible in orbit mode too, so the user sees both hands for
  // two-hand navigation; it's cleared each frame when no hands are present.
  overlay.setVisible(true);
  twoHandNav.reset();
  // If we were mid-stroke when entering orbit, finalize it cleanly.
  if (on && strokeManager.isDrawing) strokeManager.finalize();

  // Per-mode accent + icon: ORBIT = green cube (3D view), DRAW = blue pencil.
  const accent = on ? '#4fd08a' : '#4f9dff';
  const chipIcon = on ? icon('cube', 18) : icon('pencilTip', 18);
  const chip =
    `<span style="display:inline-flex;align-items:center;justify-content:center;` +
    `width:34px;height:34px;border-radius:10px;flex:0 0 auto;color:${accent};` +
    `background:${accent}22;border:1px solid ${accent}55">${chipIcon}</span>`;
  const title = `<b style="color:${accent};font-weight:700">${on ? 'Orbit mode' : 'Draw mode'}</b>`;
  const body = on
    ? `open palm rotates · two hands pinch to zoom + rotate · press ${keyBadge('O')} to go back and draw`
    : `pinch to draw · fist to move · press ${keyBadge('O')} to orbit &amp; view your art in 3D`;
  hint.innerHTML = `${chip}<span style="line-height:1.45">${title}&nbsp;&mdash; ${body}</span>`;
}
setOrbitMode(false); // initialize hint text
window.addEventListener('keydown', (e) => {
  if (e.key === 'o' || e.key === 'O') setOrbitMode(!orbitMode);
});

// --- Tool + physics controls (top-right buttons) ---------------------------
// Eraser tool: when ON, an open-palm wipe erases strokes (pinch still draws;
// see the effectiveState logic in the vision loop). Gravity: toggles the Rapier
// simulation — ON drops the strokes, OFF restores them to where they were drawn.
let eraserMode = false;
const controls = new ControlBar(container);

// Shape-tool picker (M11) — Freeform keeps raw strokes; the rest snap on finalize.
controls.addIconRadioGroup<DrawTool>(
  [
    { html: icon('pencil'), value: 'freeform', title: 'Freeform' },
    { html: icon('line'), value: 'line', title: 'Line' },
    { html: icon('rectangle'), value: 'rectangle', title: 'Rectangle' },
    { html: icon('square'), value: 'square', title: 'Square' },
    { html: icon('circle'), value: 'circle', title: 'Circle' },
    { html: icon('ellipse'), value: 'ellipse', title: 'Ellipse' },
    { html: icon('triangle'), value: 'triangle', title: 'Triangle' },
    { html: icon('arrow'), value: 'arrow', title: 'Arrow' },
  ],
  (tool) => strokeManager.setTool(tool),
);
controls.addDivider();

// Color swatches — first is selected by default; sets the brush color.
controls.addColorSwatches(
  [0x4f9dff, 0x4fd08a, 0xffb84f, 0xff5a5a, 0xc77dff, 0xffffff],
  (hex) => strokeManager.setColor(hex),
);
// Thickness options (tube radius in world units).
controls.addRadioGroup(
  [
    { label: 'S', value: 0.035 },
    { label: 'M', value: 0.06 },
    { label: 'L', value: 0.1 },
  ],
  (radius) => strokeManager.setRadius(radius),
);
controls.addDivider();

// Pen-style picker (M12).
controls.addIconRadioGroup<PenStyle>(
  [
    { html: icon('penSolid'), value: 'solid', title: 'Solid pen' },
    { html: icon('penGlow'), value: 'glow', title: 'Glow pen' },
    { html: icon('penMarker'), value: 'marker', title: 'Marker / highlighter' },
    { html: icon('penCalligraphy'), value: 'calligraphy', title: 'Calligraphy (tapered)' },
    { html: icon('penDashed'), value: 'dashed', title: 'Dashed pen' },
  ],
  (pen) => strokeManager.setPen(pen),
);
controls.addDivider();

controls.addToggle('eraser', icon('eraser'), 'Eraser (open palm wipes)', (active) => {
  eraserMode = active;
});
controls.addToggle('gravity', icon('gravity'), 'Gravity', (active) => {
  if (active) physics.enable(strokeManager.all);
  else physics.reset();
});
// Clear all strokes (and reset physics if it's running).
controls.addButton(icon('trash'), 'Clear all', () => {
  physics.reset();
  controls.setActive('gravity', false);
  strokeManager.clear();
});
// Export the finalized strokes to a downloadable .gltf (PRD F10).
controls.addButton(icon('download'), 'Export GLTF', () => {
  exportToGLTF(strokeManager.all.map((s) => s.mesh));
});

// Reused scratch vectors so the per-frame mapping allocates nothing.
const cursorWorld = new THREE.Vector3();
const palmWorld = new THREE.Vector3();

// Open-palm wipe uses a bigger radius than the pinch eraser — a palm covers a
// wider area, so it clears strokes more broadly.
const PALM_ERASE_RADIUS = 1.1;

// Grace period for brief tracking dropouts: when the hand vanishes mid-stroke
// (e.g. motion blur during a fast circle), we keep the active stroke frozen for
// up to this many consecutive missing frames before giving up and finalizing.
// If the hand reappears within the window, drawing resumes seamlessly.
const LOST_HAND_GRACE_FRAMES = 10;
let missingFrames = 0;

// Grab-release grace: while grabbing, tolerate a few frames where the fist is
// momentarily NOT detected (fast motion blurs the hand and can spike a finger
// curl, briefly kicking the FSM out of GRABBING). We only actually drop the
// stroke after the fist has been gone this many consecutive frames — so moving
// a grabbed stroke quickly no longer releases it.
const GRAB_RELEASE_GRACE_FRAMES = 6;
let grabReleaseFrames = 0;

// One Euro settings for NORMALIZED landmark coords (x,y ∈ [0,1]).
//  - minCutoff (1.5): smoothing at rest — kills resting jitter.
//  - beta (0.7): how fast the cutoff rises with hand speed. Because the input
//    is normalized (small speed magnitudes), beta must be relatively large or
//    the filter over-smooths and the skeleton visibly lags the hand. 0.7 keeps
//    fast motion responsive while still steady at rest.
//  - dCutoff (1.0): smoothing of the speed estimate itself.
const smoother = new LandmarkSmoother({ minCutoff: 1.5, beta: 0.7, dCutoff: 1.0 });
const gestureFSM = new GestureFSM();

/**
 * Load the model, request the camera, and start emitting landmarks. Each frame
 * we smooth the landmarks, compute metrics, and update the overlay + HUD. Any
 * failure shows the retry overlay (DESIGN §10) so the user can retry in place.
 */
async function startVision() {
  try {
    await tracker.init(); // WASM + model load
    await tracker.startCamera(); // getUserMedia (may throw on denial)
    tracker.start((hands) => {
      // Primary hand (index 0) drives all single-hand interactions; the second
      // hand only matters for two-hand navigation in orbit mode.
      const landmarks = hands[0] ?? null;

      // In orbit mode we don't draw. Instead, TWO pinching hands zoom + rotate
      // the camera (M10). Show the hand skeletons so the user has feedback.
      if (orbitMode) {
        if (interaction.isGrabbing) interaction.endGrab();
        grabReleaseFrames = 0;
        cursor.hide();
        overlay.drawHands(hands);

        const tNav = performance.now() / 1000;
        if (hands.length === 2) {
          // Two hands: pinch to zoom + rotate.
          palmOrbit.reset();
          const nav = twoHandNav.update(hands[0], hands[1], tNav);
          if (nav) sceneManager.orbitBy(nav.dAzimuth, nav.dPolar, nav.scale);
        } else if (hands.length === 1) {
          // One open palm: rotate the view like spinning a globe.
          twoHandNav.reset();
          const rot = palmOrbit.update(hands[0], tNav);
          if (rot) sceneManager.orbitBy(rot.dAzimuth, rot.dPolar, 1);
        } else {
          twoHandNav.reset();
          palmOrbit.reset();
        }
        return;
      }
      if (!landmarks) {
        // Hand briefly lost. If we're mid-stroke OR mid-grab, hold on for a few
        // frames (grace period) so a fast-motion blur doesn't drop the pen or
        // release the grabbed stroke; state simply freezes until the hand
        // returns.
        if (
          (strokeManager.isDrawing || interaction.isGrabbing) &&
          missingFrames < LOST_HAND_GRACE_FRAMES
        ) {
          missingFrames++;
          return; // keep filters/FSM/stroke/grab intact; wait for the hand
        }
        // Truly lost (idle, or grace expired): reset filters + FSM so a
        // reacquired hand doesn't snap from stale state, and finalize any stroke
        // (DESIGN §10 "lost hand"). Also drop any grabbed stroke.
        smoother.reset();
        gestureFSM.reset();
        if (strokeManager.isDrawing) strokeManager.finalize();
        if (interaction.isGrabbing) interaction.endGrab();
        grabReleaseFrames = 0;
        overlay.draw(null);
        cursor.hide();
        metricsHud.update(null, gestureFSM.current);
        return;
      }
      // Hand present again: clear the grace counter.
      missingFrames = 0;
      // Timestamp in seconds for the One Euro filter's dt computation.
      const tSeconds = performance.now() / 1000;
      const smoothed = smoother.smooth(landmarks, tSeconds);
      const metrics = computeMetrics(smoothed);
      const state = gestureFSM.update(metrics);

      // When the Eraser tool is on, erasing is triggered by an OPEN PALM wipe
      // (openPalm latch). A pinch still draws — the eraser is palm-only, so you
      // can erase without switching off the pen for precise touch-ups later.
      // `effectiveState` is what the app acts on and colors the cursor (red while
      // erasing); the raw FSM state is unchanged. Grab still overrides.
      const palmErase = eraserMode && gestureFSM.openPalm && state !== 'GRABBING';
      const effectiveState = palmErase ? 'ERASING' : state;

      // Map the pinch midpoint to the drawing plane by unprojecting through the
      // camera, so the cursor lands exactly on the skeleton's pinch point
      // (DESIGN §4). For a palm wipe, follow the palm center instead. Update the
      // 3D cursor so the user sees where a stroke/erase goes.
      cursorFromLandmarks(smoothed, sceneManager.camera, cursorWorld);
      if (palmErase) palmCenterFromLandmarks(smoothed, sceneManager.camera, palmWorld);
      cursor.update(palmErase ? palmWorld : cursorWorld, effectiveState, strokeManager.color);

      // GRAB takes priority over everything else. While a grab is held (or
      // within its release grace), a transient pinch misread from motion blur
      // must NOT start a stroke or erase — this is what stopped fast fist-moves
      // from drawing a stray line.
      if (state === 'GRABBING' || interaction.isGrabbing) {
        if (state === 'GRABBING') {
          grabReleaseFrames = 0;
          if (!interaction.isGrabbing) interaction.beginGrab(cursorWorld, strokeManager.all);
          else interaction.moveGrab(cursorWorld);
        } else {
          // isGrabbing but the FSM momentarily left GRABBING: hold the grab for a
          // few frames (release grace) before actually dropping it.
          grabReleaseFrames++;
          if (grabReleaseFrames >= GRAB_RELEASE_GRACE_FRAMES) {
            interaction.endGrab();
            grabReleaseFrames = 0;
          }
        }
      } else if (palmErase) {
        // Eraser tool + open palm: wipe strokes at the palm center (wide radius).
        strokeManager.eraseNear(palmWorld, PALM_ERASE_RADIUS);
      } else if (state === 'DRAWING') {
        // Stroke lifecycle: begin on the DRAWING edge, extend while held.
        if (!strokeManager.isDrawing) strokeManager.begin(cursorWorld);
        else strokeManager.extend(cursorWorld);
      } else if (strokeManager.isDrawing) {
        // Left DRAWING: finalize into a persistent tube.
        strokeManager.finalize();
      }

      overlay.draw(smoothed);
      metricsHud.update(metrics, effectiveState);
    });
  } catch (err) {
    console.error('[AirCanvas] Vision startup failed:', err);
    showErrorOverlay(describeCameraError(err), () => void startVision());
  }
}

void startVision();

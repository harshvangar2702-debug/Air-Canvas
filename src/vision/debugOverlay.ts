import type { Landmark } from './handTracker';

/**
 * MediaPipe Hands landmark connections (pairs of landmark indices that form the
 * skeleton). Grouped by finger for clarity; used only for the debug overlay.
 * See GESTURES.md "Landmark index reference".
 */
const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [0, 17],
];

/**
 * DebugOverlay renders the raw hand landmarks onto a 2D canvas that sits on top
 * of the scene. This is a temporary visualization for M1 so we can confirm the
 * webcam + tracking pipeline works before any smoothing or gesture logic.
 *
 * The overlay is MIRRORED horizontally (selfie view) so moving your hand right
 * moves the dots right, matching how users expect a webcam preview to behave
 * (DESIGN §4 step 2: x = 1 - x).
 */
export class DebugOverlay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    // Sit above the WebGL canvas; ignore pointer events so orbit controls (M5)
    // still receive the mouse.
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2', // above the video (0) and WebGL canvas (1), below the HUD (5)
    });
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable for debug overlay');
    this.ctx = ctx;

    this.resize(container);
    window.addEventListener('resize', () => this.resize(container));
  }

  private resize(container: HTMLElement) {
    // Match the drawing buffer to the CSS size (device-pixel aware) so dots are
    // crisp and land in the right place.
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Show/hide the whole overlay (hidden during orbit mode). */
  setVisible(visible: boolean): void {
    this.canvas.style.visibility = visible ? 'visible' : 'hidden';
  }

  /** Draw a single hand's landmarks (or clear if null). Single-hand convenience. */
  draw(landmarks: Landmark[] | null) {
    this.drawHands(landmarks ? [landmarks] : []);
  }

  /** Clear, then draw every detected hand's skeleton + joints (0..2 hands). */
  drawHands(hands: Landmark[][]) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.clearRect(0, 0, w, h);

    // Convert a normalized landmark to overlay pixel coords, mirrored in x.
    const px = (lm: Landmark) => (1 - lm.x) * w; // selfie mirror
    const py = (lm: Landmark) => lm.y * h;

    for (const landmarks of hands) {
      // Skeleton lines first, so joints draw on top.
      this.ctx.strokeStyle = 'rgba(79, 157, 255, 0.9)';
      this.ctx.lineWidth = 3;
      for (const [a, b] of HAND_CONNECTIONS) {
        const la = landmarks[a];
        const lb = landmarks[b];
        if (!la || !lb) continue;
        this.ctx.beginPath();
        this.ctx.moveTo(px(la), py(la));
        this.ctx.lineTo(px(lb), py(lb));
        this.ctx.stroke();
      }

      // 21 landmark dots.
      this.ctx.fillStyle = '#ffd24f';
      for (const lm of landmarks) {
        this.ctx.beginPath();
        this.ctx.arc(px(lm), py(lm), 5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}

import type { Landmark } from '../vision/handTracker';
import { computeMetrics } from '../gestures/metrics';
import { LM } from '../gestures/metrics';
import { OneEuroFilter } from '../vision/oneEuro';

/** Per-frame navigation delta consumed by SceneManager.orbitBy(). */
export interface NavDelta {
  dAzimuth: number; // radians to rotate around the target this frame
  dPolar: number; // radians of vertical orbit this frame
  scale: number; // multiply camera radius (>1 zoom out, <1 zoom in)
}

// Pinch thresholds mirror the drawing FSM (hysteresis: engage < enter, release
// > exit) so "both hands pinching" is stable, not flickery.
const PINCH_ENTER = 0.35;
const PINCH_EXIT = 0.5;

// Sensitivity: how strongly hand spacing maps to zoom. 1 = raw ratio.
const ZOOM_GAIN = 1.0;

/**
 * TwoHandNav turns a two-hand "pinch and move" into camera zoom + rotate, the
 * way pinch-to-zoom works on a trackpad but in the air (M10). Used only in orbit
 * mode.
 *
 * Metrics (all in normalized image space, selfie-mirrored to match the view):
 *  - separation = distance between the two pinch points → zoom (spread apart to
 *    zoom in, together to zoom out).
 *  - angle of the line joining them → azimuth rotation (twist both hands).
 *  - vertical midpoint → polar (raise/lower both hands to tilt).
 *
 * Both hands must be pinching to engage; releasing either hand ends the gesture.
 * Separation and angle are One-Euro-smoothed to kill jitter (hard rule).
 */
export class TwoHandNav {
  private engaged = false;

  // Per-hand pinch latches (hysteresis).
  private pinchA = false;
  private pinchB = false;

  // Smoothed reference values from the previous engaged frame.
  private lastSep = 0;
  private lastAngle = 0;
  private lastMidY = 0;

  // One Euro filters for the two continuous signals. Timestamps in seconds.
  private sepFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.3, dCutoff: 1.0 });
  private angleFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.3, dCutoff: 1.0 });

  /**
   * Feed the two hands. Returns a NavDelta while engaged, or null when not (not
   * both pinching). `tSeconds` is a monotonic timestamp for the filters.
   */
  update(handA: Landmark[], handB: Landmark[], tSeconds: number): NavDelta | null {
    // Hysteresis per hand: engage below enter, release above exit, else hold.
    const pinchDistA = computeMetrics(handA).pinchDist;
    const pinchDistB = computeMetrics(handB).pinchDist;
    if (pinchDistA < PINCH_ENTER) this.pinchA = true;
    else if (pinchDistA > PINCH_EXIT) this.pinchA = false;
    if (pinchDistB < PINCH_ENTER) this.pinchB = true;
    else if (pinchDistB > PINCH_EXIT) this.pinchB = false;

    if (!(this.pinchA && this.pinchB)) {
      this.engaged = false;
      return null;
    }

    // Pinch point per hand = thumb/index midpoint (normalized, selfie-mirrored so
    // rotation direction matches what the user sees).
    const ax = 1 - (handA[LM.THUMB_TIP].x + handA[LM.INDEX_TIP].x) / 2;
    const ay = (handA[LM.THUMB_TIP].y + handA[LM.INDEX_TIP].y) / 2;
    const bx = 1 - (handB[LM.THUMB_TIP].x + handB[LM.INDEX_TIP].x) / 2;
    const by = (handB[LM.THUMB_TIP].y + handB[LM.INDEX_TIP].y) / 2;

    const rawSep = Math.hypot(bx - ax, by - ay);
    const rawAngle = Math.atan2(by - ay, bx - ax);
    const midY = (ay + by) / 2;

    const sep = this.sepFilter.filter(rawSep, tSeconds);
    const angle = this.angleFilter.filter(rawAngle, tSeconds);

    // First engaged frame: seed baselines, emit no motion.
    if (!this.engaged) {
      this.engaged = true;
      this.lastSep = sep;
      this.lastAngle = angle;
      this.lastMidY = midY;
      return { dAzimuth: 0, dPolar: 0, scale: 1 };
    }

    // Zoom: hands spreading apart (sep grows) should zoom IN → shrink radius, so
    // scale = lastSep / sep. Guard against divide-by-zero.
    const scale =
      sep > 1e-4 ? 1 + (this.lastSep / sep - 1) * ZOOM_GAIN : 1;

    // Rotate: change in the joining-line angle → azimuth. Vertical drift → polar.
    const dAzimuth = angle - this.lastAngle;
    const dPolar = (midY - this.lastMidY) * Math.PI; // full screen height ≈ ±π/… feel

    this.lastSep = sep;
    this.lastAngle = angle;
    this.lastMidY = midY;

    return { dAzimuth, dPolar, scale };
  }

  /** Force-release (e.g. when leaving orbit mode). */
  reset(): void {
    this.engaged = false;
    this.pinchA = false;
    this.pinchB = false;
    this.sepFilter.reset();
    this.angleFilter.reset();
  }

  get isEngaged(): boolean {
    return this.engaged;
  }
}

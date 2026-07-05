import type { Landmark } from '../vision/handTracker';
import { computeMetrics, LM } from '../gestures/metrics';
import { OneEuroFilter } from '../vision/oneEuro';

/** One-hand orbit delta (no zoom — that's the two-hand gesture). */
export interface RotateDelta {
  dAzimuth: number;
  dPolar: number;
}

// Open-palm hysteresis on finger curls (all extended), matching the FSM values.
const PALM_ENTER = 1.5;
const PALM_EXIT = 1.3;

// How far a full-screen palm sweep rotates the view (radians per normalized unit).
const AZIMUTH_GAIN = 4.0;
const POLAR_GAIN = 4.0;

/**
 * PalmOrbit: in orbit mode, an open palm grabs the view and rotates it as you
 * move your hand — like spinning a globe (M10 addition). Zoom stays a two-hand
 * gesture; this is one-hand rotate only.
 *
 * Palm-open uses curl hysteresis; the palm center is One-Euro-smoothed so the
 * rotation is steady (hard rule: hysteresis + smoothing, no flicker).
 */
export class PalmOrbit {
  private engaged = false;
  private isOpen = false;
  private lastX = 0;
  private lastY = 0;

  private xFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.3, dCutoff: 1.0 });
  private yFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.3, dCutoff: 1.0 });

  /** Feed one hand; returns a rotate delta while an open palm is held, else null. */
  update(hand: Landmark[], tSeconds: number): RotateDelta | null {
    const { curls } = computeMetrics(hand);
    const allExtended =
      curls.index > PALM_ENTER &&
      curls.middle > PALM_ENTER &&
      curls.ring > PALM_ENTER &&
      curls.pinky > PALM_ENTER;
    const anyRetracted =
      curls.index < PALM_EXIT ||
      curls.middle < PALM_EXIT ||
      curls.ring < PALM_EXIT ||
      curls.pinky < PALM_EXIT;
    if (allExtended) this.isOpen = true;
    else if (anyRetracted) this.isOpen = false;

    if (!this.isOpen) {
      this.engaged = false;
      return null;
    }

    // Palm center = wrist↔middle-MCP midpoint (normalized, selfie-mirrored so a
    // rightward hand move rotates the view rightward).
    const rawX = 1 - (hand[LM.WRIST].x + hand[LM.MIDDLE_MCP].x) / 2;
    const rawY = (hand[LM.WRIST].y + hand[LM.MIDDLE_MCP].y) / 2;
    const x = this.xFilter.filter(rawX, tSeconds);
    const y = this.yFilter.filter(rawY, tSeconds);

    if (!this.engaged) {
      this.engaged = true;
      this.lastX = x;
      this.lastY = y;
      return { dAzimuth: 0, dPolar: 0 };
    }

    const dAzimuth = (x - this.lastX) * AZIMUTH_GAIN;
    const dPolar = (y - this.lastY) * POLAR_GAIN;
    this.lastX = x;
    this.lastY = y;
    return { dAzimuth, dPolar };
  }

  reset(): void {
    this.engaged = false;
    this.isOpen = false;
    this.xFilter.reset();
    this.yFilter.reset();
  }
}

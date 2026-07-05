import type { HandMetrics } from './metrics';

/**
 * Gesture states for v1 (DESIGN §5). The FSM classifies IDLE/DRAWING/GRABBING
 * from the hand pose. ERASING is an APP-level state: it isn't a distinct pose —
 * it's a pinch while the Eraser tool button is on — so main.ts derives it, but
 * it shares this type (and the cursor/HUD color maps).
 */
export type GestureState = 'IDLE' | 'DRAWING' | 'GRABBING' | 'ERASING';

/**
 * All thresholds live here as documented, tunable constants (GESTURES.md).
 * Two thresholds per gesture give hysteresis (enter ≠ exit); `debounceFrames`
 * adds an N-frame hold so a state only commits after it persists — together
 * these kill the flicker that a single threshold would produce near the border.
 */
export interface GestureThresholds {
  /** Pinch engages when pinchDist drops below this (GESTURES.md: 0.35). */
  pinchEnter: number;
  /** Pinch releases when pinchDist rises above this (GESTURES.md: 0.5). */
  pinchExit: number;
  /** Fist engages when ALL finger curls drop below this. */
  grabEnter: number;
  /** Fist releases when ANY finger curl rises above this. */
  grabExit: number;
  /** Open palm engages when ALL finger curls rise above this (fully extended). */
  palmEnter: number;
  /** Open palm releases when ANY finger curl drops below this. */
  palmExit: number;
  /** Frames a new candidate state must persist before it is committed. */
  debounceFrames: number;
}

/**
 * Defaults. Pinch values are straight from GESTURES.md. Grab values are set
 * from the metrics observed on-device (fist curls ≈0.68–0.86, open ≈1.7–1.9),
 * since GESTURES.md's 0.7 starting value read a touch tight; these get
 * finalized when grab-to-move lands in M6.
 */
export const DEFAULT_THRESHOLDS: GestureThresholds = {
  pinchEnter: 0.35,
  pinchExit: 0.5,
  grabEnter: 1.0,
  grabExit: 1.2,
  // Open palm = all fingers well extended. From observed metrics an open hand
  // reads curls ≈1.6–1.95, so ~1.5 enter / ~1.3 exit sits comfortably above the
  // grab range and leaves a hysteresis gap.
  palmEnter: 1.5,
  palmExit: 1.3,
  debounceFrames: 2,
};

/**
 * GestureFSM turns a stream of per-frame metrics into a stable gesture state.
 *
 * Two layers of anti-flicker (GESTURES.md):
 *  1. Hysteresis on the raw booleans (isPinching / isGrabbing) — once engaged,
 *     a gesture stays engaged until the metric crosses the *other*, looser
 *     threshold, so noise around a single value can't toggle it.
 *  2. Debounce on the committed state — a newly-desired state must be requested
 *     for `debounceFrames` consecutive frames before we actually switch.
 */
export class GestureFSM {
  private state: GestureState = 'IDLE';
  private t: GestureThresholds;

  // Hysteresis latches (raw gesture engagement, pre-debounce).
  private isPinching = false;
  private isGrabbing = false;
  private isOpenPalm = false;

  // Debounce bookkeeping: which state we're counting toward, and for how long.
  private candidate: GestureState = 'IDLE';
  private candidateFrames = 0;

  constructor(thresholds: GestureThresholds = DEFAULT_THRESHOLDS) {
    this.t = thresholds;
  }

  /** Feed one frame of metrics; returns the (possibly unchanged) stable state. */
  update(metrics: HandMetrics): GestureState {
    // --- Layer 1: hysteresis on each raw gesture --------------------------
    // Fist: engage when every finger is curled (all curls below grabEnter),
    // release when any finger extends past grabExit.
    const { index, middle, ring, pinky } = metrics.curls;
    const allCurled =
      index < this.t.grabEnter &&
      middle < this.t.grabEnter &&
      ring < this.t.grabEnter &&
      pinky < this.t.grabEnter;
    const anyExtended =
      index > this.t.grabExit ||
      middle > this.t.grabExit ||
      ring > this.t.grabExit ||
      pinky > this.t.grabExit;
    if (allCurled) this.isGrabbing = true;
    else if (anyExtended) this.isGrabbing = false;

    // Pinch: engage below pinchEnter, release above pinchExit, else hold.
    // A closed fist also brings the thumb + index tips close (small pinchDist),
    // so a raw pinchDist test alone would misread every fist as a pinch. We
    // therefore require the hand NOT be a full fist (`!allCurled`) for a pinch
    // to engage — a draw-pinch keeps the middle/ring/pinky extended, a fist
    // does not. This encodes GESTURES.md's "grab = not pinching" the other way
    // round: pinch only when the hand is otherwise open.
    if (metrics.pinchDist < this.t.pinchEnter && !allCurled) this.isPinching = true;
    else if (metrics.pinchDist > this.t.pinchExit || allCurled) this.isPinching = false;

    // Open palm: all fingers extended past palmEnter, released when any drops
    // below palmExit. Exposed via `openPalm` for app-level policy (palm-erase);
    // it does not drive a core FSM state on its own (a resting open hand is IDLE).
    const allExtended =
      index > this.t.palmEnter &&
      middle > this.t.palmEnter &&
      ring > this.t.palmEnter &&
      pinky > this.t.palmEnter;
    const anyBelowPalmExit =
      index < this.t.palmExit ||
      middle < this.t.palmExit ||
      ring < this.t.palmExit ||
      pinky < this.t.palmExit;
    if (allExtended) this.isOpenPalm = true;
    else if (anyBelowPalmExit) this.isOpenPalm = false;

    // --- Resolve the desired state ----------------------------------------
    // Pinch wins over grab: drawing is the primary action, and a pinch is a more
    // deliberate pose than a loose fist. (ERASING is not produced here — it's a
    // pinch re-interpreted by main.ts when the Eraser tool is on.)
    const desired: GestureState = this.isPinching
      ? 'DRAWING'
      : this.isGrabbing
        ? 'GRABBING'
        : 'IDLE';

    // --- Layer 2: debounce the committed state ----------------------------
    if (desired === this.state) {
      // Already there; cancel any pending switch.
      this.candidate = desired;
      this.candidateFrames = 0;
    } else if (desired === this.candidate) {
      // Same pending candidate as last frame; count toward the threshold.
      this.candidateFrames++;
      if (this.candidateFrames >= this.t.debounceFrames) {
        this.state = desired;
        this.candidateFrames = 0;
      }
    } else {
      // New candidate; restart the debounce counter.
      this.candidate = desired;
      this.candidateFrames = 1;
    }

    return this.state;
  }

  get current(): GestureState {
    return this.state;
  }

  /** True while an open palm is held (hysteresis-filtered). App-level policy. */
  get openPalm(): boolean {
    return this.isOpenPalm;
  }

  /** Reset to IDLE and clear all latches (call when the hand is lost). */
  reset(): void {
    this.state = 'IDLE';
    this.isPinching = false;
    this.isGrabbing = false;
    this.isOpenPalm = false;
    this.candidate = 'IDLE';
    this.candidateFrames = 0;
  }
}

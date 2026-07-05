/**
 * One Euro Filter — adaptive low-pass filter for noisy real-time signals.
 *
 * The core idea (Casiez, Roussel & Vogel, 2012): use a low cutoff frequency
 * when the signal moves slowly (kills jitter while the hand is still) and raise
 * the cutoff as the signal speeds up (reduces lag during fast motion). This
 * gives smooth cursors without the "swimming" lag of a fixed low-pass filter.
 *
 * Tuning:
 *  - minCutoff: baseline smoothing at rest. Lower = smoother but laggier.
 *  - beta: how aggressively the cutoff rises with speed. Higher = less lag on
 *          fast motion, but more jitter passes through.
 *  - dCutoff: cutoff for the derivative (speed) estimate itself.
 */
export interface OneEuroParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

/** Smoothing factor for a first-order low-pass, given cutoff freq and dt. */
function smoothingAlpha(cutoff: number, dt: number): number {
  // tau = 1 / (2π·fc); alpha = 1 / (1 + tau/dt).
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/** A scalar One Euro filter. Compose these for multi-dimensional signals. */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private xPrev: number | null = null; // last filtered value
  private dxPrev = 0; // last filtered derivative
  private tPrev = 0; // last timestamp (seconds)

  constructor(params: OneEuroParams) {
    this.minCutoff = params.minCutoff;
    this.beta = params.beta;
    this.dCutoff = params.dCutoff;
  }

  /**
   * Filter one sample. `t` is a timestamp in seconds (monotonic). On the first
   * call the value passes through unchanged and seeds the filter state.
   */
  filter(x: number, t: number): number {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }

    const dt = t - this.tPrev;
    // Guard against zero/negative dt (duplicate timestamps) which would blow up
    // the alpha computation.
    if (dt <= 0) return this.xPrev;
    this.tPrev = t;

    // 1. Estimate speed (derivative) and low-pass it with dCutoff.
    const dx = (x - this.xPrev) / dt;
    const aD = smoothingAlpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    // 2. Adapt the cutoff to the (absolute) speed, then low-pass the value.
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = smoothingAlpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = 0;
  }
}

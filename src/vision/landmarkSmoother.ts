import { OneEuroFilter, type OneEuroParams } from './oneEuro';
import type { Landmark } from './handTracker';

/**
 * Smooths a full 21-landmark hand by running an independent One Euro filter on
 * each landmark's x, y, and z. This is applied BEFORE any metric or gesture
 * computation (GESTURES.md anti-flicker rule).
 *
 * We lazily allocate 21×3 = 63 scalar filters on first use, since the landmark
 * count is fixed once tracking starts.
 */
export class LandmarkSmoother {
  private filters: OneEuroFilter[][] = []; // [landmarkIndex][x|y|z]
  private params: OneEuroParams;

  constructor(params: OneEuroParams) {
    this.params = params;
  }

  private ensure(count: number): void {
    while (this.filters.length < count) {
      this.filters.push([
        new OneEuroFilter(this.params),
        new OneEuroFilter(this.params),
        new OneEuroFilter(this.params),
      ]);
    }
  }

  /** Smooth one frame of landmarks. `tSeconds` is a monotonic timestamp. */
  smooth(landmarks: Landmark[], tSeconds: number): Landmark[] {
    this.ensure(landmarks.length);
    return landmarks.map((lm, i) => ({
      x: this.filters[i][0].filter(lm.x, tSeconds),
      y: this.filters[i][1].filter(lm.y, tSeconds),
      z: this.filters[i][2].filter(lm.z, tSeconds),
    }));
  }

  /** Reset all filter state, e.g. when the hand is lost and reacquired. */
  reset(): void {
    for (const trio of this.filters) trio.forEach((f) => f.reset());
  }
}
